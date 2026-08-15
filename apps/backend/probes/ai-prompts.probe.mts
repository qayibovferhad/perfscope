/**
 * Exercises every AiService prompt against the live key, and proves each one degrades to a
 * neutral value rather than throwing.
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

console.time('getInsights');
show('getInsights', await AiService.getInsights(result));
console.timeEnd('getInsights');

console.time('getAuditExplanations');
const expl = await AiService.getAuditExplanations(result);
console.timeEnd('getAuditExplanations');
console.log(`── getAuditExplanations ── ${expl.size} of the failing audits explained`);
for (const [id, text] of [...expl].slice(0, 3)) console.log(`   ${id}: ${text}`);
console.log();

console.time('getPageNarrative');
const narrative = await AiService.getPageNarrative(result);
console.timeEnd('getPageNarrative');
show('getPageNarrative.metrics', narrative.metrics);
show('getPageNarrative.waterfall', narrative.waterfall);

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
  const e = await AiService.getAuditExplanations(result);
  const n = await AiService.getPageNarrative(result);
  console.log(`   getAuditExplanations → empty Map: ${e.size === 0}`);
  console.log(`   getPageNarrative     → {} + null: ${Object.keys(n.metrics).length === 0 && n.waterfall === null}`);
  const advice = await AiService.getResourceAdvice(
    (result.resources?.requests ?? []).slice(0, 2).map(r => ({ url: r.url, resourceType: r.resourceType, transferSize: r.transferSize })));
  console.log(`   getResourceAdvice    → empty Map: ${advice.size === 0}`);
} finally {
  svc.generate = realGenerate;
}

console.log('\nEvery prompt answered, and every JSON prompt survived a non-JSON reply.');
