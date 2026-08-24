/**
 * The dashboard used to answer one question — the last thirty days, every site — and the
 * answer was baked into the service. Two controls now sit above it, and the thing worth
 * asserting is not that they render but that the *numbers move*: a range that changes the
 * label and nothing else, or a site filter that greys a chip while the totals stay put, is
 * worse than no control at all.
 *
 * History is seeded straight into Mongo across a ninety-day span, two sites, so each range
 * and each site has a different, known answer.
 *
 *   node e2e/dashboard-range.probe.mjs [outDir]
 */
import { mkdirSync } from 'node:fs';
import { MongoClient, ObjectId } from 'mongodb';
import {
  WEB_URL, BACKEND_URL, MONGODB_URI, registerUser, cleanupUser,
  launchAuthedBrowser, waitForServers, sleep,
} from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-dashboard-range';
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/** Audits placed at known ages, so each window contains a known number of them. */
const PLAN = [
  { host: 'alpha.probe.test', daysAgo: 1,  score: 90 },
  { host: 'alpha.probe.test', daysAgo: 3,  score: 80 },
  { host: 'alpha.probe.test', daysAgo: 20, score: 70 },
  { host: 'alpha.probe.test', daysAgo: 60, score: 60 },
  { host: 'beta.probe.test',  daysAgo: 2,  score: 50 },
  { host: 'beta.probe.test',  daysAgo: 45, score: 40 },
];
const within = (days, host) => PLAN.filter(p => p.daysAgo <= days && (!host || p.host === host)).length;

/** The UTC day an audit `n` days old lands on — the same key the picker's cells carry. */
const dayKey = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

/** How many seeded audits fall inside an explicit range, by day key. */
const betweenDays = (fromDaysAgo, toDaysAgo, host) => PLAN.filter(p =>
  dayKey(p.daysAgo) >= dayKey(fromDaysAgo) && dayKey(p.daysAgo) <= dayKey(toDaysAgo)
  && (!host || p.host === host)).length;

await waitForServers();
const { token, user, email } = await registerUser();
const userId = String(user.sub ?? user.id);

for (const host of ['alpha.probe.test', 'beta.probe.test']) {
  await fetch(`${BACKEND_URL}/api/websites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url: `https://${host}`, name: host }),
  });
}

const mongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await mongo.connect();
await mongo.db().collection('histories').insertMany(PLAN.map((p, i) => {
  const at = new Date(Date.now() - p.daysAgo * 86_400_000);
  return {
    analysisId: `range-probe-${i}`, shortId: `rp-${i}`,
    url: `https://${p.host}/`, normalizedUrl: `${p.host}/`, routePath: '/',
    userId,
    scores:  { performance: p.score, accessibility: 90, bestPractices: 90, seo: 90 },
    metrics: { fcp: 1000, lcp: 2000, tbt: 100, cls: 0.05, si: 1500, tti: 2500 },
    fullResult: { id: `range-probe-${i}`, url: `https://${p.host}/`, scores: { performance: p.score } },
    source: 'manual', createdAt: at, updatedAt: at,
  };
}));
await mongo.close();

const { browser, page, errors } = await launchAuthedBrowser({ user, token });

/** The one number that has to follow both controls. */
const auditCount = () => page.evaluate(() => {
  const card = [...document.querySelectorAll('div')]
    .find(d => /^Audits(\s|·)/.test(d.textContent?.trim() ?? '') && d.querySelector('b'));
  const text = document.body.innerText;
  const m = text.match(/(\d+)\s*\n\s*Audits[^\n]*/) ?? text.match(/Audits[^\n]*\n\s*(\d+)/);
  return { fromCard: card?.querySelector('b')?.textContent?.trim() ?? null, fromText: m?.[1] ?? null };
});

const shown = async () => {
  const v = await auditCount();
  return Number(v.fromCard ?? v.fromText ?? NaN);
};


/**
 * Click the first element matching `selector` (optionally the first whose text matches
 * `text`), with a real pointer at its centre.
 *
 * `element.click()` does not take the same default-action path a pointer does — the Stop
 * saga cost most of a day to that, and a listbox and a calendar are almost entirely
 * default-action behaviour.
 */
async function clickText(page, selector, text) {
  const box = await page.evaluate((sel, pattern) => {
    const re = pattern ? new RegExp(pattern) : null;
    const el = [...document.querySelectorAll(sel)]
      .find(e => !re || re.test(e.textContent ?? ''));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector, text ? text.source : null);

  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}

/** Click a day in the open calendar, paging back a month at a time until it is on screen. */
async function pickDay(page, day) {
  for (let i = 0; i < 14; i++) {
    if (await clickText(page, `button[aria-label="${day}"]`)) return true;
    if (!await clickText(page, '[aria-label="Previous month"]')) return false;
    await sleep(150);
  }
  return false;
}

try {
  for (const days of [7, 30, 90]) {
    await page.goto(`${WEB_URL}/dashboard?days=${days}`, { waitUntil: 'networkidle0' });
    await sleep(2200);
    const count = await shown();
    console.log(`  ${String(days).padStart(2)} days, all sites → ${count} (expected ${within(days)})`);
    check(count === within(days), `the ${days}-day window counts only what falls inside it`);
  }

  // The same window, one site: a filter that does not change the number is not a filter.
  // It is a select now, so this is open-then-choose rather than one click — and both go
  // through a real pointer, because a listbox is almost entirely default-action behaviour.
  await clickText(page, '[aria-label="Site filter"]');
  await sleep(600);
  const chose = await clickText(page, '[role="option"]', /alpha/);
  check(chose, 'the site select offers the account\'s own sites');
  await sleep(2200);
  const scopedId = await page.evaluate(() => new URLSearchParams(location.search).get('site'));
  const scoped = await shown();
  console.log(`  90 days, alpha only → ${scoped} (expected ${within(90, 'alpha.probe.test')})`);
  check(!!scopedId, `choosing a site puts it in the address (${scopedId ?? 'nothing'})`);
  check(scoped === within(90, 'alpha.probe.test'), 'and the totals count that site alone');

  // Both controls together, and the label that names the window.
  await page.goto(`${WEB_URL}/dashboard?days=7&site=${scopedId}`, { waitUntil: 'networkidle0' });
  await sleep(2200);
  const both = await shown();
  console.log(`  7 days, alpha only  → ${both} (expected ${within(7, 'alpha.probe.test')})`);
  check(both === within(7, 'alpha.probe.test'), 'the two controls compose');
  check(/Audits · 7 days/.test(await page.evaluate(() => document.body.innerText)),
    'and the card is named after the window on screen');

  await page.goto(`${WEB_URL}/dashboard?days=90`, { waitUntil: 'networkidle0' });
  await sleep(2000);
  check(/Audits · 90 days/.test(await page.evaluate(() => document.body.innerText)),
    'which changes with it');
  check((await page.evaluate(() => document.body.innerText)).includes('90 days'),
    'the charts state the same window');
  await page.screenshot({ path: `${OUT}/dashboard-90d.png` });

  // ─── The picker itself ─────────────────────────────────────────────────────
  // A preset first: it has to write the shorthand and clear any explicit pair, or the two
  // would disagree in the address and the pair would silently win.
  await page.goto(`${WEB_URL}/dashboard?from=${dayKey(60)}&to=${dayKey(50)}`, { waitUntil: 'networkidle0' });
  await sleep(2000);
  check(await clickText(page, '[aria-label="Time range"]'), 'the range picker opens');
  await sleep(400);
  await page.screenshot({ path: `${OUT}/picker-open.png` });
  check(await clickText(page, 'button', /^7 days$/), 'and offers the presets');
  await sleep(2200);

  const afterPreset = await page.evaluate(() => location.search);
  check(/days=7/.test(afterPreset) && !/from=/.test(afterPreset),
    `a preset writes the shorthand and drops the explicit pair (${afterPreset})`);
  check(await shown() === within(7), 'and the numbers follow it');

  // Then two clicks on the calendar. The window deliberately ends *before* today, which is
  // the thing the old three-button control could not ask for at all.
  const [fromAgo, toAgo] = [21, 5];
  check(await clickText(page, '[aria-label="Time range"]'), 'the picker opens again');
  await sleep(400);
  check(await pickDay(page, dayKey(toAgo)), `the calendar reaches ${dayKey(toAgo)}`);
  await sleep(250);
  check(await pickDay(page, dayKey(fromAgo)), `and ${dayKey(fromAgo)}`);
  await sleep(2400);

  const custom = await page.evaluate(() => location.search);
  check(custom.includes(`from=${dayKey(fromAgo)}`) && custom.includes(`to=${dayKey(toAgo)}`),
    `two clicks put the range in the address (${custom})`);
  check(!/days=/.test(custom), 'and drop the shorthand');

  const inCustom = await shown();
  console.log(`  ${dayKey(fromAgo)} → ${dayKey(toAgo)} → ${inCustom} (expected ${betweenDays(fromAgo, toAgo)})`);
  check(inCustom === betweenDays(fromAgo, toAgo),
    'a window that ends before today counts only the runs inside it');

  const label = await page.evaluate(() => document.body.innerText);
  check(!/last \d+ days|· \d+ days/.test(label.split('Audits')[1]?.slice(0, 40) ?? ''),
    'and is named by its dates rather than by a day count it does not have');
  await page.screenshot({ path: `${OUT}/custom-range.png` });

  // A site that is not theirs must narrow to nothing rather than leak someone else's data.
  await page.goto(`${WEB_URL}/dashboard?days=90&site=${new ObjectId().toString()}`, { waitUntil: 'networkidle0' });
  await sleep(2200);
  check(await shown() === 0, 'a site id that is not this account\'s shows nothing at all');

  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map(e => e.text).join(' | ') || 'none'})`);
  console.log(`  screenshots → ${OUT}`);
} finally {
  await browser.close();
  const cleanup = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await cleanup.connect();
  await cleanup.db().collection('histories').deleteMany({ userId });
  await cleanup.close();
  await cleanupUser(email);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
