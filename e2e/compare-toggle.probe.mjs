/**
 * The comparison layer is one feature seen from four places — score and vital deltas, the
 * resource strip, the waterfall tags, the new/fixed audit lists — and one switch turns all
 * of it on and off. This proves that: that the switch appears only when there *is* an
 * earlier run, that every one of the four surfaces obeys it, and that the choice survives
 * a reload, because a preference that resets every session is one nobody sets.
 *
 * A previous run is seeded straight into Mongo rather than audited twice — the point under
 * test is the switch, not the measurement.
 *
 *   node e2e/compare-toggle.probe.mjs [outDir]
 */
import { mkdirSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import {
  WEB_URL, MONGODB_URI, registerUser, cleanupUser, launchAuthedBrowser,
  waitForServers, sleep, bodyText,
} from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-compare-toggle';
mkdirSync(OUT, { recursive: true });

const TARGET = 'https://example.com';

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

function previousRunDoc(userId) {
  const fullResult = {
    id: 'e2e-toggle-seed',
    url: TARGET,
    timestamp: new Date(Date.now() - 3600_000).toISOString(),
    formFactor: 'desktop',
    scores:  { performance: 42, accessibility: 71, bestPractices: 63, seo: 70 },
    metrics: { fcp: 3400, lcp: 5200, tbt: 890, cls: 0.31, si: 4800, tti: 7100 },
    audits: [{ id: 'e2e-gone-audit', title: 'A problem that is no longer reported', description: '', score: 0.2, impact: 'critical' }],
    resources: {
      requests: [
        { url: `${TARGET}/legacy-bundle.js`, transferSize: 410_000, resourceType: 'script' },
        { url: `${TARGET}/hero-uncompressed.png`, transferSize: 980_000, resourceType: 'image' },
      ],
      summary: {}, thirdPartyRequests: [], jsFiles: [], detectedLibraries: [{ name: 'jQuery' }],
    },
    thirdParty: [],
  };
  return {
    analysisId: fullResult.id, shortId: fullResult.id.slice(0, 7),
    url: TARGET, normalizedUrl: TARGET, routePath: '/',
    userId, scores: fullResult.scores, metrics: fullResult.metrics, fullResult,
    source: 'manual',
    createdAt: new Date(Date.now() - 3600_000), updatedAt: new Date(Date.now() - 3600_000),
  };
}

/** The four surfaces, counted together — the switch has to move all of them at once. */
const comparisonSignals = async (page) => {
  const text = await bodyText(page);
  const badges = await page.$$eval('span[title]', (els) =>
    els.filter((e) => /than the previous run|Unchanged/i.test(e.getAttribute('title') ?? '')).length);
  return {
    badges,
    caption:   /compared with the run from/i.test(text),
    strip:     /since last run/i.test(text),
    fixedList: /no longer reported since last run/i.test(text),
  };
};

const setToggle = (page, on) =>
  page.evaluate((want) => {
    const sw = document.querySelector('[role="switch"][aria-label="Compare with last audit"]');
    if (!sw) return false;
    if ((sw.getAttribute('aria-checked') === 'true') !== want) sw.click();
    return true;
  }, on);

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
  for (let i = 0; i < 240; i++) {
    if (/compared with the run from/i.test(await bodyText(page))) break;
    await sleep(500);
  }
  await sleep(1200);

  // ─── On by default ─────────────────────────────────────────────────────────
  const sw = await page.$('[role="switch"][aria-label="Compare with last audit"]');
  check(!!sw, 'the switch is on the page when an earlier run exists');
  check(await page.$eval('[role="switch"][aria-label="Compare with last audit"]', (e) => e.getAttribute('aria-checked')) === 'true',
    'it starts on — the comparison is the point of having run twice');
  check(/compare with last audit/i.test(await bodyText(page)), 'and it is labelled in words, not only for screen readers');

  const on = await comparisonSignals(page);
  console.log(`  on:  ${JSON.stringify(on)}`);
  check(on.badges >= 8, `every score and vital carries a delta (${on.badges})`);
  check(on.caption, 'the caption names the run being compared against');
  check(on.strip, 'the "since last run" strip is present');
  check(on.fixedList, 'the audit list offers what is no longer reported');
  await page.screenshot({ path: `${OUT}/on.png` });

  // ─── Switched off ──────────────────────────────────────────────────────────
  check(await setToggle(page, false), 'the switch can be turned off');
  await sleep(500);
  const off = await comparisonSignals(page);
  console.log(`  off: ${JSON.stringify(off)}`);
  check(off.badges === 0, `no deltas remain (${off.badges})`);
  check(!off.caption, 'no caption');
  check(!off.strip, 'no resource strip');
  check(!off.fixedList, 'no "no longer reported" list');
  await page.screenshot({ path: `${OUT}/off.png` });

  // The report itself must still be whole — turning the comparison off is not turning
  // half the page off.
  const stillThere = await bodyText(page);
  check(/opportunities & diagnostics/i.test(stillThere), 'the audit list is still there');
  check(/core web vitals/i.test(stillThere), 'the vitals are still there');

  // ─── The choice sticks ─────────────────────────────────────────────────────
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('perfscope-audit-mode') ?? '{}')?.state?.compareWithPrevious);
  check(persisted === false, `the preference survives a reload (${persisted})`);

  // ─── And back on ───────────────────────────────────────────────────────────
  await page.goto(`${WEB_URL}/app?url=${encodeURIComponent(TARGET)}`, { waitUntil: 'networkidle0' });
  for (let i = 0; i < 240; i++) {
    if (/opportunities & diagnostics/i.test(await bodyText(page))) break;
    await sleep(500);
  }
  await sleep(1200);
  const stillOff = await comparisonSignals(page);
  check(stillOff.badges === 0 && !stillOff.caption, 'a fresh audit honours the stored preference');
  check(await setToggle(page, true), 'the switch is still offered so it can be turned back on');
  await sleep(500);
  const backOn = await comparisonSignals(page);
  console.log(`  back on: ${JSON.stringify(backOn)}`);
  check(backOn.badges >= 8 && backOn.caption, 'and the comparison comes straight back');

  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map((e) => e.text).join(' | ') || 'none'})`);
} finally {
  await browser.close();
  await cleanupUser(email);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
