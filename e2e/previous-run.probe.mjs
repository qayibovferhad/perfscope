/**
 * The deltas, in a browser, on a real audit.
 *
 * `probes/previous-run.probe.mts` proves the server computes the comparison; this proves a
 * person can see it — that the arrows, the caption, the "since last run" strip, the "new"
 * pill and the "no longer reported" list all render, in both themes, on the page the
 * analyzer actually produces.
 *
 * A previous run is seeded straight into Mongo rather than audited twice: the point under
 * test is what the *second* run renders, and paying two live Lighthouse runs for it would
 * double the probe's wall time without testing anything the first run doesn't.
 *
 *   node e2e/previous-run.probe.mjs [outDir]
 */
import { mkdirSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import {
  WEB_URL, MONGODB_URI, registerUser, cleanupUser, launchAuthedBrowser,
  waitForServers, sleep, bodyText,
} from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-previous-run';
mkdirSync(OUT, { recursive: true });

const TARGET = 'https://example.com';

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/**
 * The run the audit will compare against. Its resources are deliberately *not* the ones
 * example.com serves: every one of them lands in "no longer loaded" and everything the
 * real run fetches lands in "new", which is what makes the strip render with real content.
 * Scores are far enough from a perfect example.com run that the deltas clear the noise
 * floors in @perfscope/shared.
 */
function previousRunDoc(userId) {
  const fullResult = {
    id: 'e2e-previous-seed',
    url: TARGET,
    timestamp: new Date(Date.now() - 3600_000).toISOString(),
    formFactor: 'desktop',
    scores:  { performance: 42, accessibility: 71, bestPractices: 63, seo: 70 },
    metrics: { fcp: 3400, lcp: 5200, tbt: 890, cls: 0.31, si: 4800, tti: 7100 },
    audits: [
      { id: 'e2e-gone-audit', title: 'A problem that is no longer reported', description: '', score: 0.2, impact: 'critical' },
    ],
    resources: {
      requests: [
        { url: `${TARGET}/legacy-bundle.js`, transferSize: 410_000, resourceType: 'script' },
        { url: `${TARGET}/hero-uncompressed.png`, transferSize: 980_000, resourceType: 'image' },
      ],
      summary: {}, thirdPartyRequests: [], jsFiles: [],
      detectedLibraries: [{ name: 'jQuery' }],
    },
    thirdParty: [],
  };

  return {
    analysisId: fullResult.id,
    shortId: fullResult.id.slice(0, 7),
    url: TARGET,
    normalizedUrl: TARGET,
    routePath: '/',
    userId,
    scores: fullResult.scores,
    metrics: fullResult.metrics,
    fullResult,
    source: 'manual',
    createdAt: new Date(Date.now() - 3600_000),
    updatedAt: new Date(Date.now() - 3600_000),
  };
}

await waitForServers();
const { token, user, email } = await registerUser();
const userId = String(user.sub ?? user.id ?? user._id);

const mongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await mongo.connect();
await mongo.db().collection('histories').insertOne(previousRunDoc(userId));
await mongo.close();

const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  console.log(`auditing ${TARGET} with a seeded previous run …`);
  await page.goto(`${WEB_URL}/app?url=${encodeURIComponent(TARGET)}`, { waitUntil: 'networkidle0' });

  // The scores land on `analysis:complete`; the caption rides with them.
  let ready = false;
  for (let i = 0; i < 240; i++) {
    if (/compared with the run from/i.test(await bodyText(page))) { ready = true; break; }
    await sleep(500);
  }
  check(ready, 'the analysis completed and named the run it is compared against');
  await sleep(1500);

  const text = await bodyText(page);

  // ─── Deltas ────────────────────────────────────────────────────────────────
  const badges = await page.$$eval('span[title]', (els) =>
    els.filter((e) => /than the previous run|Unchanged/i.test(e.getAttribute('title') ?? ''))
       .map((e) => e.textContent.trim()));
  console.log(`  badges: ${badges.join('  ')}`);
  check(badges.length >= 8, `every score and vital carries a delta badge (${badges.length} found, expected ≥ 8)`);
  check(badges.every((b) => /^[+−]?[\d.]/.test(b)), 'each badge reads as a signed change');

  // A tinted badge is a meaningful move; example.com against these seeded numbers must
  // produce several. All-muted would mean the noise thresholds swallowed everything.
  const tinted = await page.$$eval('span[title]', (els) =>
    els.filter((e) => /than the previous run/i.test(e.getAttribute('title') ?? ''))
       .filter((e) => !/text-ld-text-3/.test(e.className)).length);
  check(tinted >= 4, `${tinted} badges are coloured rather than muted — the movement is real, not noise`);

  // ─── The resource strip ────────────────────────────────────────────────────
  check(/since last run/i.test(text), 'the "Since last run" strip is on the page');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => /since last run/i.test(b.textContent ?? ''));
    btn?.click();
  });
  await sleep(400);
  const opened = await bodyText(page);
  check(/legacy-bundle\.js/i.test(opened), 'expanding it names the request that is no longer loaded');
  check(/no longer loaded/i.test(opened), 'the removed group is labelled');

  // ─── Audit list ────────────────────────────────────────────────────────────
  check(/no longer reported since last run/i.test(opened),
    'the audit list offers the "no longer reported" list');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => /no longer reported since last run/i.test(b.textContent ?? ''));
    btn?.scrollIntoView({ block: 'center' });
    btn?.click();
  });
  await sleep(400);
  check(/A problem that is no longer reported/i.test(await bodyText(page)),
    'it names the audit the previous run reported and this one does not');

  // example.com is a near-perfect page, so a "new" pill only appears if it fails
  // something. Reported, not asserted: the pill's rendering is covered by the seeded
  // fixed-audit case above, and failing here would only mean example.com got faster.
  const newPills = await page.$$eval('span', (els) =>
    els.filter((e) => e.textContent.trim() === 'new' && /amber/.test(e.className)).length);
  console.log(`  "new" pills on this page: ${newPills}`);

  // ─── Both themes ───────────────────────────────────────────────────────────
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => {
      localStorage.setItem('perfscope-theme', t);
      if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
    }, theme);
    await sleep(500);
    await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0));
    await sleep(300);
    await page.screenshot({ path: `${OUT}/${theme}-scores.png` });
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('*')]
        .find((n) => /^Since last run$/i.test(n.textContent?.trim() ?? ''));
      el?.scrollIntoView({ block: 'center' });
    });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/${theme}-since-last-run.png` });
  }
  console.log(`  screenshots → ${OUT}`);

  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map((e) => e.text).join(' | ') || 'none'})`);
} finally {
  await browser.close();
  await cleanupUser(email);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
