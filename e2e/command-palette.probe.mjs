/**
 * The ⌘K palette.
 *
 * Asserted through real key events rather than `element.click()`, for the reason recorded
 * in project_known_issues: a synthetic click skips the browser's default-action path, and
 * a palette is almost entirely default-action behaviour — the shortcut, the arrows, Enter,
 * Escape. A probe that dispatched clicks would pass while the thing was unusable.
 *
 *   node e2e/command-palette.probe.mjs [outDir]
 */
import { mkdirSync } from 'node:fs';
import {
  WEB_URL, BACKEND_URL, registerUser, cleanupUser,
  launchAuthedBrowser, waitForServers, sleep,
} from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-palette';
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

await waitForServers();
const { token, user, email } = await registerUser();

for (const host of ['alpha.palette.test', 'beta.palette.test']) {
  await fetch(`${BACKEND_URL}/api/websites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url: `https://${host}`, name: host }),
  });
}

const { browser, page, errors } = await launchAuthedBrowser({ user, token });

const isOpen = () => page.evaluate(() => !!document.querySelector('[aria-label="Command palette"]'));
const rows = () => page.evaluate(() =>
  [...document.querySelectorAll('[aria-label="Command palette"] [data-active]')]
    .map(b => ({ label: b.innerText.split('\n')[0].trim(), active: b.dataset.active === 'true' })));
const activeRow = async () => (await rows()).find(r => r.active)?.label ?? null;

const hit = async (...keys) => {
  for (const k of keys) await page.keyboard.down(k);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
  await sleep(220);
};

try {
  await page.goto(`${WEB_URL}/dashboard`, { waitUntil: 'networkidle0' });
  await sleep(1800);

  check(!(await isOpen()), 'the palette stays out of the way until asked for');

  await hit('Control', 'k');
  check(await isOpen(), 'Ctrl-K opens it');
  await page.screenshot({ path: `${OUT}/open.png` });

  const initial = await rows();
  check(initial.length > 3, `it opens with something to choose (${initial.length} rows)`);
  check(initial[0]?.active === true, 'with the first row already selected, so Enter means something');

  // Escape, then reopened: a palette that remembers the last query makes the second use
  // a deletion before it can be a search.
  await page.keyboard.type('alpha');
  await sleep(300);
  const filtered = await rows();
  check(filtered.length > 0 && filtered.every(r => /alpha/i.test(r.label)),
    `typing narrows to what matches (${filtered.map(r => r.label).join(' | ')})`);

  await hit('Escape');
  check(!(await isOpen()), 'Escape closes it');
  await hit('Control', 'k');
  check((await rows()).length === initial.length, 'and it reopens blank rather than where it was left');

  // Subsequence matching: initials, not a substring.
  await page.keyboard.type('ash');
  await sleep(300);
  check((await activeRow()) === 'Audit schedule',
    `initials find the page ("ash" → ${await activeRow()})`);

  // Arrow keys walk the list the eye is reading.
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('palette.test');
  await sleep(300);
  const first = await activeRow();
  await hit('ArrowDown');
  const second = await activeRow();
  check(!!first && !!second && first !== second, `ArrowDown moves the selection (${first} → ${second})`);
  await hit('ArrowUp');
  check((await activeRow()) === first, 'and ArrowUp comes back');

  // Enter runs it. "Audit <host>" navigates to the analyzer carrying the URL.
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.type('audit alpha');
  await sleep(300);
  const chosen = await activeRow();
  await hit('Enter');
  await sleep(1200);

  check(!(await isOpen()), 'choosing a command closes the palette');

  // The analyzer strips `?url=` from the address once it has consumed it — reloading a
  // page that re-runs an audit is its own bug — so the evidence that the command ran is
  // an audit in flight, not the query string that started it.
  const started = await page.evaluate(() => ({
    path: location.pathname,
    stopping: /\bStop\b/.test(document.body.innerText),
    host: /alpha\.palette\.test/.test(document.body.innerText),
  }));
  check(started.path === '/app' && started.stopping && started.host,
    `and runs it — "${chosen}" → ${started.path}, audit in flight: ${started.stopping}`);
  await page.screenshot({ path: `${OUT}/after-enter.png` });

  // Nothing matching is said plainly rather than shown as an empty box.
  await hit('Control', 'k');
  await page.keyboard.type('zzzzqqq');
  await sleep(300);
  check(/Nothing matches/.test(await page.evaluate(() => document.body.innerText)),
    'an unmatched query says so');
  await hit('Escape');

  // The sidebar advertises it — a shortcut nobody is told about is one nobody uses.
  check(await page.evaluate(() => /⌘K/.test(document.body.innerText)),
    'the shortcut is visible in the shell');

  const real = errors.filter(e => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map(e => e.text).join(' | ') || 'none'})`);
  console.log(`  screenshots → ${OUT}`);
} finally {
  await browser.close();
  await cleanupUser(email);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
