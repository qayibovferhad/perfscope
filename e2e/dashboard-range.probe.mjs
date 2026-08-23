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

try {
  for (const days of [7, 30, 90]) {
    await page.goto(`${WEB_URL}/dashboard?days=${days}`, { waitUntil: 'networkidle0' });
    await sleep(2200);
    const count = await shown();
    console.log(`  ${String(days).padStart(2)} days, all sites → ${count} (expected ${within(days)})`);
    check(count === within(days), `the ${days}-day window counts only what falls inside it`);
  }

  // The same window, one site: a filter that does not change the number is not a filter.
  const siteId = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[aria-label="Site filter"] button')]
      .find(b => /alpha/.test(b.textContent ?? ''));
    btn?.click();
    return btn ? new URLSearchParams(location.search).get('site') : null;
  });
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
  check(/Audits this week/.test(await page.evaluate(() => document.body.innerText)),
    'and the card is named after the window on screen');

  await page.goto(`${WEB_URL}/dashboard?days=90`, { waitUntil: 'networkidle0' });
  await sleep(2000);
  check(/Audits · 90 days/.test(await page.evaluate(() => document.body.innerText)),
    'which changes with it');
  check((await page.evaluate(() => document.body.innerText)).includes('last 90 days'),
    'the charts state the same window');
  await page.screenshot({ path: `${OUT}/dashboard-90d.png` });

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
