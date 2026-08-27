/**
 * The report screen, panel by panel, at a desk and on a phone.
 *
 * `app-a11y.probe.mts` sweeps the nine signed-in routes and reports 100 on every one of
 * them — but the result it seeds `/app` with is an **AI fixture**, and `trimForAi` throws
 * away `timelineData`, `dependencyGraph` and `bundles` on the way to disk. The report the
 * sweep audits is therefore the report's *thin* branch: no waterfall, no flame chart, no
 * dependency chain, no treemap, no layout-shift visualiser. Those are the densest
 * components in the product and none of them has ever been audited.
 *
 * So this one does not seed a fixture. It **runs a real audit** of a page that produces
 * every artefact, stores an older copy first so the delta layer renders too, opens the
 * stored result the way the app opens it, and then measures three things at both widths:
 *
 *   1. which panels actually drew — a 100 over a screen that rendered four of eleven
 *      panels is not a result, and this is the number that makes the rest meaningful;
 *   2. Lighthouse's accessibility snapshot of that DOM, with the failing selectors;
 *   3. what bleeds past the right edge — Lighthouse does not check that, and the report
 *      is where the widest components in the app live.
 *
 * Reports rather than asserts, like the sweep it complements: it is the instrument for a
 * UI pass, and a threshold baked in here would be a number nobody agreed to.
 *
 *   cd apps/backend && npx tsx probes/report-a11y.probe.mts [url]
 *
 * Needs the dev servers (5173 + 3101), Mongo and a real Chrome. The default target is the
 * dashboard's own dev server: a bundler in dev mode emits hundreds of module requests, a
 * long task and a layout shift, which is exactly the shape that fills every panel.
 */
import puppeteer, { type Page } from 'puppeteer';
import { startFlow } from 'lighthouse';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { CHROME_ARGS } from '../src/lib/chrome.js';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.model.js';
import { Website } from '../src/models/Website.model.js';
import { HistoryModel } from '../src/models/History.model.js';
import { lighthouseService } from '../src/services/lighthouse.service.js';
import { attachPreviousRun } from '../src/services/auditPipeline.js';
import type { AnalysisResult } from '@perfscope/shared';

const WEB_URL = process.env['WEB_URL'] ?? 'http://localhost:5173';
const TARGET  = process.argv[2] ?? `${WEB_URL}/`;

const VIEWPORTS = [
  { name: 'desktop', width: 1350, height: 940, deviceScaleFactor: 1 },
  { name: 'phone',   width: 412,  height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true },
] as const;

/**
 * Every panel the report can draw, by the heading it renders.
 *
 * Listed in the order the page lays them out, so a gap in the output reads as a gap in the
 * screen. `has: false` is not a failure — a page with no layout shift has nothing for the
 * visualiser to show — but it does mean this run measured nothing about that panel.
 */
const PANELS: { label: string; needle: string }[] = [
  { label: 'Scores',                needle: 'Scores' },
  { label: 'Core Web Vitals',       needle: 'Core Web Vitals' },
  { label: 'Waterfall',             needle: 'Network Waterfall' },
  { label: 'Flame chart',           needle: 'CPU Main Thread' },
  { label: 'Since last run',        needle: 'Since last run' },
  { label: 'Resource breakdown',    needle: 'Resource Breakdown' },
  { label: 'Bundle treemap',        needle: 'JavaScript' },
  { label: 'Dependency chain',      needle: 'Resource Dependency Chain' },
  { label: 'Heap memory',           needle: 'JS Heap Memory' },
  { label: 'Interactions',          needle: 'Interaction Responsiveness' },
  { label: 'Layout shift',          needle: 'Layout Shift Visualizer' },
  { label: 'Field data',            needle: 'Field data' },
  { label: 'Third parties',         needle: 'Third parties' },
  { label: 'Audit list',            needle: 'Opportunities' },
];

/** A token for a throwaway account, signed the way the middleware reads it (`sub`). */
function signToken(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${body}.${createHmac('sha256', config.jwtSecret).update(body).digest('base64url')}`;
}

/**
 * Anything sticking out past the right edge that is not inside something built to scroll
 * sideways. A waterfall lane and a treemap are *meant* to scroll; a heading is not.
 * Same rule as `e2e/mobile-layout.probe.mjs`, applied to the panels it never reaches.
 */
const bleeding = (page: Page) => page.evaluate(() => {
  const win = window.innerWidth;
  return [...document.querySelectorAll('main *')]
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ e, r }) => {
      if (r.width < 2 || r.right <= win + 1) return false;
      for (let p = e.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return false;
      }
      return true;
    })
    .slice(0, 10)
    .map(({ e, r }) => `${e.tagName.toLowerCase()}.${String(e.className).trim().split(/\s+/).slice(0, 2).join('.')} → +${Math.round(r.right - win)}px`);
});

// ─── A real audit, and an older one to compare it against ────────────────────
await mongoose.connect(config.mongoUri);

const email = `report-a11y-${Date.now()}@probe.test`;
const account = await User.create({ name: 'Report A11y Probe', email, provider: 'email' });
const userId = String(account._id);
await Website.create({ userId: account._id, url: TARGET.replace(/\/$/, ''), name: 'Report probe' });

console.log(`\n  auditing ${TARGET} …`);
const started = Date.now();
const result = await lighthouseService.analyze(TARGET, { runs: 1, captureElements: true, formFactor: 'desktop' });
console.log(`  audited in ${Math.round((Date.now() - started) / 1000)}s · ` +
  `${result.resources?.requests.length ?? 0} requests · ${result.audits.length} audits`);

/**
 * Two artefacts a navigation audit cannot produce: nobody clicked the page, and the heap
 * sampler needs a session that lasted. They are grafted from a captured fixture so the two
 * panels that read them are drawn at all — the *layout and labelling* of those panels is
 * what is being measured here, and that does not depend on whose numbers are in them.
 */
const donor = JSON.parse(readFileSync(new URL('./fixtures/landau.cubicsbms.com.json', import.meta.url), 'utf8')) as AnalysisResult;
const grafted: string[] = [];
if (!result.interactionData && donor.interactionData) { result.interactionData = donor.interactionData; grafted.push('interactions'); }
if (!result.heapMemoryData  && donor.heapMemoryData)  { result.heapMemoryData  = donor.heapMemoryData;  grafted.push('heap'); }
// And one a page can simply not have: a stable page does not shift, so the visualiser
// would never be on screen to audit.
if (!result.clsData && donor.clsData) { result.clsData = donor.clsData; grafted.push('layout shifts'); }
if (grafted.length) console.log(`  grafted from the fixture: ${grafted.join(', ')}`);

/**
 * The same run, stored a day earlier with the scores nudged, is what makes `previous`
 * exist: the delta arrows, the "compare with last audit" switch and the Since-last-run
 * panel all render nothing without one, and all three are part of this screen.
 */
const olderId = randomUUID();
const dayAgo = new Date(Date.now() - 86_400_000);
const older: AnalysisResult = {
  ...result,
  id: olderId,
  timestamp: dayAgo.toISOString(),
  scores: { ...result.scores, performance: Math.max(0, result.scores.performance - 8) },
  // A resource that is gone and one that shrank, so the diff crosses its noise floors.
  ...(result.resources ? { resources: { ...result.resources, requests: result.resources.requests.slice(1) } } : {}),
};
await HistoryModel.create({
  analysisId: olderId, shortId: olderId.slice(0, 7), url: result.url,
  normalizedUrl: result.url.replace(/^https?:\/\//, ''), routePath: new URL(result.url).pathname,
  userId, scores: older.scores, metrics: older.metrics, fullResult: older,
  source: 'manual', createdAt: dayAgo, updatedAt: dayAgo,
});

await attachPreviousRun(result, userId);
console.log(`  previous run: ${result.previous ? `yes (diff ${result.previous.resourceDiff ? 'present' : 'below noise floor'})` : 'MISSING'}`);

/**
 * What the audit actually produced. A panel that did not draw is only a gap in *this*
 * probe's coverage when the data for it was there — a page with no layout shift has
 * nothing for the visualiser to show, and saying so is the difference between a hole in
 * the measurement and a hole in the product.
 */
const ARTEFACTS = ['timelineData', 'resources', 'flameChartData', 'dependencyGraph', 'bundles',
  'clsData', 'heapMemoryData', 'interactionData', 'thirdParty', 'previous'] as const;
const asRecord = result as unknown as Record<string, unknown>;
console.log(`  artefacts    : ${ARTEFACTS.filter(k => asRecord[k] != null).join(', ')}`);
console.log(`  absent       : ${ARTEFACTS.filter(k => asRecord[k] == null).join(', ') || 'none'}`);

const analysisId = result.id;
await HistoryModel.create({
  analysisId, shortId: analysisId.slice(0, 7), url: result.url,
  normalizedUrl: result.url.replace(/^https?:\/\//, ''), routePath: new URL(result.url).pathname,
  userId, scores: result.scores, metrics: result.metrics, fullResult: result,
  source: 'manual', createdAt: new Date(), updatedAt: new Date(),
});

// ─── The screen ──────────────────────────────────────────────────────────────
const user = { sub: userId, name: account.name, email, picture: '' };
const token = signToken({ ...user, exp: Math.floor(Date.now() / 1000) + 3600 });

const browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });
const page = await browser.newPage();
await page.evaluateOnNewDocument(
  (state) => {
    try {
      localStorage.setItem('perfscope-auth', JSON.stringify({ state, version: 0 }));
      // The comparison layer is off by default, at the user's request — so the delta
      // arrows, the Since-last-run panel, the waterfall's change tags and the new/fixed
      // audit lists are a whole feature that nobody has ever audited. Turned on here.
      localStorage.setItem('perfscope-audit-mode', JSON.stringify({
        state: { formFactor: 'desktop', precision: 'single', compareWithPrevious: true }, version: 0,
      }));
    } catch { /* opaque origin */ }
  },
  { user, token, refreshToken: null },
);

interface Failure { id: string; title: string; items: number; nodes: string[] }
interface Row { name: string; score: number | null; failures: Failure[]; missing: string[]; bleeds: string[] }
const rows: Row[] = [];

try {
  for (const viewport of VIEWPORTS) {
    const { name, ...vp } = viewport;
    await page.setViewport(vp);
    // The extension's own deep link — the door that already exists — rather than reaching
    // into a store to load the result.
    await page.goto(`${WEB_URL}/history?open=${analysisId}`, { waitUntil: 'networkidle0' });
    await new Promise((resolve) => setTimeout(resolve, 6000));

    // Case-insensitively: several of these headings are uppercased in CSS, and `innerText`
    // reports rendered text — matching case would have called them missing.
    const present = await page.evaluate((needles: string[]) => {
      const text = (document.querySelector('main') as HTMLElement | null)?.innerText.toLowerCase() ?? '';
      return needles.filter((n) => text.includes(n.toLowerCase()));
    }, PANELS.map((p) => p.needle));
    const missing = PANELS.filter((p) => !present.includes(p.needle)).map((p) => p.label);

    const bleeds = await bleeding(page);

    const flow = await startFlow(page, { name, flags: { screenEmulation: { disabled: true } } });
    await flow.snapshot({ name });
    const lhr = (await flow.createFlowResult()).steps[0]!.lhr;

    const score = lhr.categories['accessibility']?.score ?? null;
    const failures = Object.entries(lhr.audits)
      .filter(([, audit]) => audit.score !== null && (audit.score ?? 1) < 1)
      .filter(([id]) => (lhr.categories['accessibility']?.auditRefs ?? []).some((ref) => ref.id === id))
      .map(([id, audit]) => {
        const items = ((audit.details as { items?: { node?: { selector?: string; snippet?: string } }[] } | undefined)?.items) ?? [];
        return {
          id,
          title: audit.title ?? id,
          items: items.length,
          nodes: items.slice(0, 4).map((item) => `${item.node?.selector ?? '?'}  ${String(item.node?.snippet ?? '').slice(0, 130)}`),
        };
      });

    rows.push({ name, score: score === null ? null : Math.round(score * 100), failures, missing, bleeds });
  }
} finally {
  await browser.close();
  await HistoryModel.deleteMany({ userId });
  await Website.deleteMany({ userId: account._id });
  await User.deleteOne({ _id: account._id });
  await mongoose.disconnect();
}

// ─── What to fix ─────────────────────────────────────────────────────────────
for (const row of rows) {
  console.log(`\n  ── ${row.name} ──`);
  console.log(`  panels drawn : ${PANELS.length - row.missing.length}/${PANELS.length}${row.missing.length ? ` · not drawn: ${row.missing.join(', ')}` : ''}`);
  console.log(`  accessibility: ${row.score}`);
  for (const failure of row.failures) {
    console.log(`    ${failure.id} — ${failure.title} (${failure.items})`);
    for (const node of failure.nodes) console.log(`      ${node}`);
  }
  if (!row.failures.length) console.log('    no failures');
  console.log(`  past the edge: ${row.bleeds.length ? row.bleeds.join(', ') : 'nothing'}`);
}

process.exit(0);
