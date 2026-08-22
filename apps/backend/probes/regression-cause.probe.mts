/**
 * A regression alert used to carry numbers and nothing else, so its AI note could only
 * restate them: "LCP got worse, check your images." This proves the note now names the
 * change that caused it — and, just as importantly, that it does not invent one when the
 * two runs are identical.
 *
 * Runs the real path: a stored previous audit, `checkRegressions`, the real diff, the
 * real prompt, and a throwaway webhook receiver on localhost so nothing leaves the box.
 *
 * From apps/backend:
 *
 *     npx tsx probes/regression-cause.probe.mts
 */
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Website } from '../src/models/Website.model.js';
import { HistoryModel } from '../src/models/History.model.js';
import { AlertLog } from '../src/models/AlertLog.model.js';
import { checkRegressions } from '../src/services/regression.service.js';
import type { AnalysisResult } from '@perfscope/shared';

const PORT = 3398;
const received: Record<string, unknown>[] = [];
const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    try { received.push(JSON.parse(Buffer.concat(chunks).toString())); } catch { /* ignore */ }
    res.writeHead(200).end('ok');
  });
});
await new Promise<void>(r => server.listen(PORT, r));

await mongoose.connect(config.mongoUri);
const userId = new mongoose.Types.ObjectId();

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const request = (url: string, transferSize: number, resourceType: string) =>
  ({ url, transferSize, resourceType });

/** Only the fields the regression path reads. The full `AnalysisResult` carries a trace,
 *  a filmstrip and a flame chart, none of which a diff or an alert ever looks at. */
const resultFor = (url: string, requests: ReturnType<typeof request>[], perf: number, lcp: number) => ({
  id: `probe-${Math.round(perf)}-${requests.length}`,
  url,
  timestamp: new Date().toISOString(),
  formFactor: 'desktop',
  scores:  { performance: perf, accessibility: 92, bestPractices: 90, seo: 95 },
  metrics: { fcp: 1200, lcp, tbt: 210, cls: 0.04, si: 2100, tti: 3400 },
  audits: [],
  resources: { requests, summary: {}, thirdPartyRequests: [], jsFiles: [], detectedLibraries: [{ name: 'React' }] },
  thirdParty: [],
} as unknown as AnalysisResult);

const BEFORE = [
  request('https://probe-cause.example/app.js', 120_000, 'script'),
  request('https://probe-cause.example/hero.jpg', 90_000, 'image'),
  request('https://probe-cause.example/style.css', 20_000, 'stylesheet'),
];

/** The change under test: the hero image ballooned and an analytics bundle appeared. */
const AFTER = [
  request('https://probe-cause.example/app.js', 120_000, 'script'),
  request('https://probe-cause.example/hero.jpg', 940_000, 'image'),
  request('https://probe-cause.example/style.css', 20_000, 'stylesheet'),
  request('https://probe-cause.example/vendor-analytics.js', 310_000, 'script'),
];

/** Any filename the note mentions must be one this page actually loads. */
const FILENAME = /\b[\w-]+\.(?:js|mjs|css|jpg|jpeg|png|webp|gif|svg|woff2?)\b/gi;
function invented(note: string, requests: ReturnType<typeof request>[]): string[] {
  const real = new Set(requests.map(r => r.url.split('/').pop()!.toLowerCase()));
  return [...new Set(note.match(FILENAME) ?? [])].filter(f => !real.has(f.toLowerCase()));
}

async function storePrevious(url: string, requests: ReturnType<typeof request>[], perf: number, lcp: number) {
  const prev = resultFor(url, requests, perf, lcp);
  await HistoryModel.create({
    analysisId: prev.id, shortId: prev.id.slice(0, 8), url, normalizedUrl: url, routePath: '/',
    userId: String(userId), scores: prev.scores, metrics: prev.metrics, fullResult: prev,
    // Earlier than the run being judged, which is what `getPreviousRun` selects on.
    createdAt: new Date(Date.now() - 60 * 60_000),
  });
}

async function siteFor(url: string) {
  return Website.create({
    userId: String(userId), url, name: 'regression cause probe',
    budgets: { webhookUrl: `http://localhost:${PORT}/raw` },
  });
}

try {
  // ─── 1. The page changed — the note must name what changed ─────────────────
  const urlA = 'https://probe-cause.example/';
  await storePrevious(urlA, BEFORE, 91, 2100);
  const siteA = await siteFor(urlA);
  await checkRegressions(resultFor(urlA, AFTER, 58, 4600), String(userId), siteA);
  await new Promise(r => setTimeout(r, 400));

  const alertA = received.at(-1);
  const noteA = String(alertA?.['aiNote'] ?? '');
  console.log('\nresources changed since the previous run');
  console.log(`  note: ${noteA || '(none)'}\n`);
  check(!!alertA, 'the regression alert was delivered');
  check(noteA.length > 0, 'the alert carries an AI note');
  check(/hero\.jpg|vendor-analytics\.js/i.test(noteA), 'the note names the file that changed');
  check(invented(noteA, AFTER).length === 0, `no invented filenames (${invented(noteA, AFTER).join(', ') || 'none'})`);

  // ─── 2. Nothing changed — the note must not manufacture a cause ────────────
  // Same resources on both sides, so the diff is empty and the prompt gets no evidence
  // block at all. A note that still names a file here would be guessing, and an alert
  // that sends someone to the wrong file is worse than one that stays with the numbers.
  const urlB = 'https://probe-cause.example/pricing';
  await storePrevious(urlB, BEFORE, 90, 2000);
  const siteB = await siteFor(urlB);
  await checkRegressions(resultFor(urlB, BEFORE, 55, 4800), String(userId), siteB);
  await new Promise(r => setTimeout(r, 400));

  const alertB = received.at(-1);
  const noteB = String(alertB?.['aiNote'] ?? '');
  console.log('\nidentical resources, metrics still regressed');
  console.log(`  note: ${noteB || '(none)'}\n`);
  check(alertB?.['url'] === urlB, 'the second alert was delivered');
  check(noteB.length > 0, 'it still gets a note (the numbers alone are worth explaining)');
  check(invented(noteB, BEFORE).length === 0, `no invented filenames (${invented(noteB, BEFORE).join(', ') || 'none'})`);

  // ─── 3. The evidence stays out of the delivered payload ────────────────────
  // The note is where a cause belongs; a webhook body listing every changed file would
  // bury the finding it came with.
  console.log('');
  check(alertA?.['evidence'] === undefined, 'the raw diff is not shipped in the webhook body');
} finally {
  await Promise.all([
    Website.deleteMany({ userId: String(userId) }),
    HistoryModel.deleteMany({ userId: String(userId) }),
    AlertLog.deleteMany({ userId }),
  ]);
  await mongoose.disconnect();
  server.close();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
