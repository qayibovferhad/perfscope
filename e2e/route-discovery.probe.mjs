/**
 * Route discovery: the site's own sitemap, offered as a picker.
 *
 * Scheduling used to mean typing every path by hand, which is why most schedules audit the
 * home page and nothing else. What is worth asserting is not that a button exists but that
 * the picked paths actually land on the schedule — and that a site with no sitemap says so
 * plainly instead of showing an empty list that reads as a failure.
 *
 *   node e2e/route-discovery.probe.mjs [outDir]
 */
import { mkdirSync } from 'node:fs';
import {
  WEB_URL, BACKEND_URL, registerUser, cleanupUser,
  launchAuthedBrowser, waitForServers, sleep,
} from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-route-discovery';
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/** Real sites, because the thing under test is reading a sitemap in the wild. */
const WITH_SITEMAP = 'https://vite.dev';
/** A single-page app: /sitemap.xml answers 200 with the app shell, not a sitemap. */
const WITHOUT      = 'https://testlandau.cubicsbms.com';

await waitForServers();
const { token, user, email } = await registerUser();

const ids = {};
for (const url of [WITH_SITEMAP, WITHOUT]) {
  const res = await fetch(`${BACKEND_URL}/api/websites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, name: new URL(url).host }),
  });
  ids[url] = (await res.json()).data._id;
}

// ── The endpoint itself ──────────────────────────────────────────────────────
const ask = async (id) => {
  const r = await fetch(`${BACKEND_URL}/api/websites/${id}/routes`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: (await r.json()).data };
};

const rich = await ask(ids[WITH_SITEMAP]);
check(rich.body.routes.length > 5, `a site with a sitemap yields its pages (${rich.body.routes.length})`);
check(rich.body.routes[0]?.path === '/', 'the home page is offered first');
check(rich.body.routes.every(r => r.path.startsWith('/')), 'every entry is a path, not an absolute URL');
check(new Set(rich.body.routes.map(r => r.path)).size === rich.body.routes.length, 'and none of them repeats');
check(rich.body.routes.length <= 100, 'a large sitemap is capped rather than dumped whole');

const bare = await ask(ids[WITHOUT]);
check(bare.body.routes.length === 0 && !!bare.body.reason,
  `an app-shell /sitemap.xml is not mistaken for a sitemap (${bare.body.reason ?? 'no reason given'})`);

// Someone else's site is not discoverable through this account.
const { token: otherToken, email: otherEmail } = await registerUser();
const forbidden = await fetch(`${BACKEND_URL}/api/websites/${ids[WITH_SITEMAP]}/routes`, {
  headers: { Authorization: `Bearer ${otherToken}` },
});
check(forbidden.status === 404, `another account cannot scan this site (${forbidden.status})`);
await cleanupUser(otherEmail);

// ── The picker ───────────────────────────────────────────────────────────────
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

const clickText = (text, sel = 'button') => page.evaluate((t, s) => {
  const el = [...document.querySelectorAll(s)].find(e => (e.textContent ?? '').includes(t));
  el?.click();
  return !!el;
}, text, sel);

try {
  await page.goto(`${WEB_URL}/automation`, { waitUntil: 'networkidle0' });
  await sleep(1500);

  // The setup button says "Set up" on every row, so it has to be found via its own row.
  const opened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b =>
      /set up/i.test(b.textContent ?? '') &&
      // Walk up until the ancestor covers the whole row, then read whose row it is.
      (() => { let n = b; for (let i = 0; i < 6 && n; i++) { n = n.parentElement;
        if (n && /set up/i.test(n.textContent ?? '') && /vite\.dev|testlandau/.test(n.textContent ?? ''))
          return /vite\.dev/.test(n.textContent ?? ''); } return false; })());
    btn?.click();
    return !!btn;
  });
  check(opened, 'the vite.dev row opens its setup modal');
  await sleep(700);

  check(await clickText('Find routes from sitemap'), 'the modal offers discovery');
  await sleep(4000);
  await page.screenshot({ path: `${OUT}/discovered.png` });

  const listed = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .map(b => b.textContent?.trim() ?? '')
      .filter(t => /^\/[a-z0-9/_-]*$/i.test(t)).length);
  check(listed > 5, `the discovered paths are listed to pick from (${listed})`);
  const counter = await page.evaluate(() => document.body.innerText.match(/\d+ found[^\n]*/i)?.[0] ?? '(no counter)');
  console.log(`  counter reads: ${JSON.stringify(counter)}`);
  check(/0 selected/i.test(counter),
    'nothing is pre-ticked — the picker is an aim, not an undo');

  // Tick two, add them, and look for them on the schedule itself.
  const picked = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('button')]
      .filter(b => /^\/[a-z0-9/_-]*$/i.test(b.textContent?.trim() ?? ''));
    const two = rows.slice(0, 2);
    two.forEach(b => b.click());
    return two.map(b => b.textContent.trim());
  });
  await sleep(400);
  const after = await page.evaluate(() => document.body.innerText.match(/\d+ found[^\n]*/i)?.[0] ?? '(no counter)');
  console.log(`  counter reads: ${JSON.stringify(after)}`);
  check(/2 selected/i.test(after), 'ticking two says two');

  check(await clickText('Add 2 routes'), 'and they can be added');
  await sleep(600);
  await page.screenshot({ path: `${OUT}/added.png` });

  const chips = await page.evaluate(() =>
    [...document.querySelectorAll('span')].map(s => s.textContent?.trim() ?? ''));
  check(picked.every(p => chips.some(c => c === p)),
    `both picked routes are on the schedule (${picked.join(' ')})`);
  check(!/found ·/.test(await page.evaluate(() => document.body.innerText)),
    'and the picker closes once it has been used');

  const real = errors.filter(e => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map(e => e.text).join(' | ') || 'none'})`);
  console.log(`  screenshots → ${OUT}`);
} finally {
  await browser.close();
  await cleanupUser(email);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
