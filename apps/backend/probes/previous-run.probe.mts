/**
 * `attachPreviousRun` is what puts a delta on every score, vital, waterfall row and audit
 * in the analyzer. It has to be right about three things a screenshot cannot check: that
 * it picks the *right* earlier run, that "new" and "no longer reported" mean what they say,
 * and that a desktop run is never used as the baseline for a mobile one.
 *
 * Runs the real path against real Mongo documents — no AI, no Lighthouse, so it is fast
 * and deterministic. Everything it writes is scoped to a throwaway user id and deleted.
 *
 * From apps/backend:
 *
 *     npx tsx probes/previous-run.probe.mts
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { HistoryModel } from '../src/models/History.model.js';
import { attachPreviousRun, persistAudit } from '../src/services/auditPipeline.js';
import type { AnalysisResult, AuditFormFactor } from '@perfscope/shared';

await mongoose.connect(config.mongoUri);
const userId = new mongoose.Types.ObjectId().toString();

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const request = (url: string, transferSize: number, resourceType = 'script') =>
  ({ url, transferSize, resourceType });

const audit = (id: string, title: string) =>
  ({ id, title, description: '', score: 0.4, displayValue: '', impact: 'high' });

function resultFor(opts: {
  url: string;
  perf: number;
  lcp: number;
  requests: ReturnType<typeof request>[];
  audits: ReturnType<typeof audit>[];
  formFactor?: AuditFormFactor;
  minutesAgo?: number;
}): AnalysisResult {
  const { url, perf, lcp, requests, audits, formFactor = 'desktop', minutesAgo = 0 } = opts;
  return {
    id: `probe-prev-${perf}-${requests.length}-${formFactor}`,
    url,
    timestamp: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    formFactor,
    scores:  { performance: perf, accessibility: 92, bestPractices: 90, seo: 95 },
    metrics: { fcp: 1200, lcp, tbt: 210, cls: 0.04, si: 2100, tti: 3400 },
    audits,
    resources: {
      requests, summary: {}, thirdPartyRequests: [], jsFiles: [],
      detectedLibraries: [{ name: 'React' }],
    },
    thirdParty: [],
  } as unknown as AnalysisResult;
}

async function store(result: AnalysisResult, minutesAgo: number) {
  await HistoryModel.create({
    analysisId: result.id, shortId: result.id.slice(0, 8),
    url: result.url, normalizedUrl: result.url, routePath: '/',
    userId, scores: result.scores, metrics: result.metrics, fullResult: result,
    createdAt: new Date(Date.now() - minutesAgo * 60_000),
  });
}

const BEFORE = [
  request('https://probe-prev.example/app.js', 120_000),
  request('https://probe-prev.example/hero.jpg', 90_000, 'image'),
  request('https://probe-prev.example/legacy.js', 40_000),
];

/** hero grew past both diff floors, an analytics bundle appeared, legacy.js is gone. */
const AFTER = [
  request('https://probe-prev.example/app.js', 120_000),
  request('https://probe-prev.example/hero.jpg', 940_000, 'image'),
  request('https://probe-prev.example/vendor-analytics.js', 310_000),
];

const AUDITS_BEFORE = [audit('unused-javascript', 'Reduce unused JavaScript'), audit('color-contrast', 'Contrast is insufficient')];
const AUDITS_AFTER  = [audit('unused-javascript', 'Reduce unused JavaScript'), audit('render-blocking-resources', 'Eliminate render-blocking resources')];

try {
  // ─── 1. The straightforward case ───────────────────────────────────────────
  const url = 'https://probe-prev.example/';
  await store(resultFor({ url, perf: 91, lcp: 2100, requests: BEFORE, audits: AUDITS_BEFORE }), 60);

  const current = resultFor({ url, perf: 58, lcp: 4600, requests: AFTER, audits: AUDITS_AFTER });
  const returned = await attachPreviousRun(current, userId);
  const prev = current.previous;

  console.log('\na previous desktop run of the same URL exists');
  check(!!prev, 'the summary is attached to the result');
  check(returned?.analysisId === prev?.analysisId, 'the full previous run is returned for the AI to reuse');
  check(prev?.scores.performance === 91, `it carries the previous scores (${prev?.scores.performance})`);
  check(prev?.metrics.lcp === 2100, `it carries the previous metrics (lcp ${prev?.metrics.lcp})`);
  check(!!prev?.at && !Number.isNaN(Date.parse(prev.at)), `\`at\` is a parseable ISO timestamp (${prev?.at})`);

  console.log('\nwhat moved');
  check(prev?.newAuditIds.length === 1 && prev.newAuditIds[0] === 'render-blocking-resources',
    `newAuditIds names only the audit that appeared (${prev?.newAuditIds.join(', ')})`);
  check(prev?.fixedAudits.length === 1 && prev.fixedAudits[0]?.id === 'color-contrast',
    `fixedAudits names only the audit that dropped out (${prev?.fixedAudits.map(f => f.id).join(', ')})`);
  check(prev?.fixedAudits[0]?.title === 'Contrast is insufficient', 'the fixed audit keeps its title, not just its id');

  const diff = prev?.resourceDiff;
  check(!!diff, 'a resource diff is attached when resources changed');
  check(diff?.added.some(r => r.url.endsWith('vendor-analytics.js')) === true,
    `added names the new bundle (${diff?.added.map(r => r.url.split('/').pop()).join(', ')})`);
  check(diff?.removed.some(r => r.url.endsWith('legacy.js')) === true,
    `removed names the dropped script (${diff?.removed.map(r => r.url.split('/').pop()).join(', ')})`);
  check(diff?.grown.some(r => r.url.endsWith('hero.jpg')) === true,
    `grown names the image (${diff?.grown.map(r => r.url.split('/').pop()).join(', ')})`);

  // ─── 2. An unchanged page must not carry an empty diff ─────────────────────
  // "Nothing shipped" is a claim worth being able to make; an empty diff object would
  // render as an empty panel, which says it far less clearly.
  const urlSame = 'https://probe-prev-same.example/';
  await store(resultFor({ url: urlSame, perf: 80, lcp: 2000, requests: BEFORE, audits: AUDITS_BEFORE }), 60);
  const same = resultFor({ url: urlSame, perf: 82, lcp: 2050, requests: BEFORE, audits: AUDITS_BEFORE });
  await attachPreviousRun(same, userId);

  console.log('\nthe page is unchanged');
  check(!!same.previous, 'a previous run is still attached (the scores did move)');
  check(same.previous?.resourceDiff === undefined, 'no resourceDiff when nothing crossed the noise floors');
  check(same.previous?.newAuditIds.length === 0 && same.previous.fixedAudits.length === 0,
    'no audits reported as new or fixed');

  // ─── 3. Form factors must not compare against each other ───────────────────
  // A mobile run measured against yesterday's desktop one differs by the emulation, not
  // by anything that shipped: every score would look regressed and every resource resized.
  const urlFf = 'https://probe-prev-ff.example/';
  await store(resultFor({ url: urlFf, perf: 95, lcp: 1000, requests: BEFORE, audits: [], formFactor: 'desktop' }), 60);

  const mobile = resultFor({ url: urlFf, perf: 40, lcp: 5000, requests: AFTER, audits: [], formFactor: 'mobile' });
  await attachPreviousRun(mobile, userId);
  console.log('\nonly a desktop run exists, this run is mobile');
  check(mobile.previous === undefined, 'no baseline is used — the desktop run is not the predecessor of a mobile one');

  await store(resultFor({ url: urlFf, perf: 44, lcp: 4800, requests: BEFORE, audits: [], formFactor: 'mobile' }), 30);
  const mobile2 = resultFor({ url: urlFf, perf: 40, lcp: 5000, requests: AFTER, audits: [], formFactor: 'mobile' });
  await attachPreviousRun(mobile2, userId);
  console.log('\na mobile run now exists too');
  check(mobile2.previous?.scores.performance === 44,
    `the mobile run is picked, not the newer-or-older desktop one (${mobile2.previous?.scores.performance})`);

  // A run saved before the form-factor toggle existed carries no field at all, and
  // lighthouse.service defaults such a run to desktop — so a desktop audit must still
  // find it rather than silently losing its history.
  const urlLegacy = 'https://probe-prev-legacy.example/';
  const legacy = resultFor({ url: urlLegacy, perf: 70, lcp: 3000, requests: BEFORE, audits: [] });
  delete (legacy as { formFactor?: unknown }).formFactor;
  await store(legacy, 60);

  const desktopNow = resultFor({ url: urlLegacy, perf: 75, lcp: 2800, requests: BEFORE, audits: [] });
  await attachPreviousRun(desktopNow, userId);
  console.log('\nthe stored run predates the form-factor toggle');
  check(desktopNow.previous?.scores.performance === 70,
    'a desktop run still finds it — a missing field is the desktop default, not "unknown"');

  // ─── 4. Nothing to compare against, and nobody to compare for ──────────────
  const urlFirst = 'https://probe-prev-first.example/';
  const first = resultFor({ url: urlFirst, perf: 88, lcp: 1900, requests: BEFORE, audits: [] });
  await attachPreviousRun(first, userId);
  console.log('\nedge cases');
  check(first.previous === undefined, 'the first-ever audit of a URL attaches nothing');

  const anon = resultFor({ url, perf: 58, lcp: 4600, requests: AFTER, audits: AUDITS_AFTER });
  const anonReturn = await attachPreviousRun(anon, undefined);
  check(anon.previous === undefined && anonReturn === null,
    'an anonymous audit attaches nothing — there is no history that belongs to it');

  // ─── 5. It survives the save ───────────────────────────────────────────────
  // The whole design rests on this: the comparison is computed once and stored on the
  // result, which is what makes a reopened history row, the public share report and the
  // CLI agree with the live view instead of each re-deriving it (or showing nothing).
  await persistAudit(current, userId, undefined);
  const stored = await HistoryModel.findOne({ analysisId: current.id, userId }).lean();
  const storedPrev = (stored as unknown as { fullResult?: { previous?: typeof prev } })?.fullResult?.previous;
  console.log('\nafter persistAudit');
  check(!!storedPrev, 'the stored audit carries the comparison');
  check(storedPrev?.analysisId === prev?.analysisId, 'it names the same previous run');
  check(storedPrev?.resourceDiff?.grown?.some(r => r.url.endsWith('hero.jpg')) === true,
    'the resource diff survived the round trip through Mongo');
} finally {
  await HistoryModel.deleteMany({ userId });
  await mongoose.disconnect();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
