/**
 * Exercises every AiService prompt against the live key, and proves each one degrades to a
 * neutral value rather than throwing.
 *
 * `analysePage` is the one that matters most: it produces the diagnosis, fixes, metric
 * notes, waterfall and per-audit lines in a single pass, so they agree by construction.
 *
 * There is no test runner in this package, so run it by hand:
 *
 *     cd apps/backend && npx tsx probes/ai-prompts.probe.mts
 *
 * It uses a stored audit as its fixture — whatever the most recent History row holds — so
 * the prompts see real shapes rather than something hand-written that drifts from them.
 */
import mongoose from 'mongoose';
import { AiService } from '../src/services/ai.service.js';
import { HistoryModel } from '../src/models/History.model.js';
import type { AnalysisResult } from '@perfscope/shared';

if (!AiService.isAvailable()) {
  console.error('GEMINI_API_KEY is not set — nothing to probe.');
  process.exit(1);
}

await mongoose.connect(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/perfscope');
const row = await HistoryModel.findOne({ fullResult: { $ne: null } }).sort({ createdAt: -1 }).lean();
await mongoose.disconnect();

if (!row?.fullResult) {
  console.error('No stored audit with a fullResult to use as a fixture. Run an audit first.');
  process.exit(1);
}
const result = row.fullResult as unknown as AnalysisResult;
console.log(`fixture: ${result.url} · perf ${result.scores.performance} · ${result.audits.length} audits · ${result.resources?.requests.length ?? 0} requests\n`);

const show = (label: string, value: unknown) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  console.log(`── ${label} ──\n${(text ?? '(null)').slice(0, 320)}\n`);
};

// ─── The real calls ──────────────────────────────────────────────────────────

console.time('analysePage');
const analysis = await AiService.analysePage(result);
console.timeEnd('analysePage');

if (!analysis) {
  console.log('── analysePage ── returned null (the model answered with something unparseable)');
} else {
  show('analysePage.diagnosis', analysis.diagnosis);
  console.log('── analysePage.fixes ──');
  analysis.fixes.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
  show('analysePage.metrics', analysis.metrics);
  show('analysePage.waterfall', analysis.waterfall);
  console.log(`── analysePage.audits ── ${Object.keys(analysis.audits).length} failing audits explained`);
  for (const [id, text] of Object.entries(analysis.audits).slice(0, 3)) console.log(`   ${id}: ${text}`);
  console.log();

  // The whole point of one pass: the surfaces must describe the same page. A metric note
  // that blames something the diagnosis never mentions is the bug this replaced.
  const words = new Set(analysis.diagnosis.toLowerCase().match(/[a-z]{5,}/g) ?? []);
  const overlaps = Object.values(analysis.metrics)
    .filter(n => (n.toLowerCase().match(/[a-z]{5,}/g) ?? []).some(w => words.has(w))).length;
  console.log(`   metric notes sharing vocabulary with the diagnosis: ${overlaps} of ${Object.keys(analysis.metrics).length}`);
  console.log();
}

show('getAlertNote', await AiService.getAlertNote({
  kind: 'budget breach',
  url: result.url,
  formFactor: 'desktop',
  lines: ['LCP 4200ms (budget ≤ 2500ms)', 'Performance score 54 (budget ≥ 80)'],
}, { timeoutMs: 5000 }));

show('getDigestSummary', await AiService.getDigestSummary({
  sites: 3, audits: 21, avgScore: 72, prevAvgScore: 78,
  regressions: 2, breaches: 1,
  slowest: [{ url: result.url, score: result.scores.performance, lcp: result.metrics.lcp }],
}));

show('getCompareVerdict', await AiService.getCompareVerdict({
  sourceUrl: result.url,
  targetUrl: 'https://example.org',
  source:     { scores: { performance: result.scores.performance }, metrics: result.metrics as unknown as Record<string, number> },
  competitor: { scores: { performance: 92 }, metrics: { lcp: 900, tbt: 20, cls: 0.01 } },
}));

// ─── The failure paths ───────────────────────────────────────────────────────
// Force the model to answer with something unparseable and confirm each JSON prompt
// returns its neutral value instead of throwing.

console.log('── neutral fallbacks (model made to reply with prose where JSON was demanded) ──');
const svc = AiService as unknown as { generate: (p: string, o?: unknown) => Promise<string> };
const realGenerate = svc.generate;
svc.generate = async () => 'Sorry, I cannot help with that.';
try {
  const a = await AiService.analysePage(result);
  console.log(`   analysePage          → null: ${a === null}`);
  const advice = await AiService.getResourceAdvice(
    (result.resources?.requests ?? []).slice(0, 2).map(r => ({ url: r.url, resourceType: r.resourceType, transferSize: r.transferSize })));
  console.log(`   getResourceAdvice    → empty Map: ${advice.size === 0}`);
} finally {
  svc.generate = realGenerate;
}

console.log('\nEvery prompt answered, and every JSON prompt survived a non-JSON reply.');
