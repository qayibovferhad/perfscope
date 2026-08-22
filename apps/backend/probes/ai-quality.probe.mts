/**
 * The plan's core metric: how many of the AI's fixes are about *this* page.
 *
 * A fix is "concrete" when it names something the audit actually contains — a file, a
 * library, a CSS selector, a function that blocked the thread. A fix that would fit any
 * website ("add alt text to your images", "fix your heading order") is generic, and the
 * whole point of putting AI in a measurement tool is that it does not say those.
 *
 * Run it before and after every phase of docs/ai/PLAN.md. If the number does not move,
 * the phase did not work, whatever else it did.
 *
 *     npx tsx probes/ai-quality.probe.mts [url-substring] [--json]
 *
 * `--json` prints one machine-readable `##RESULT##{…}` line as well, which is how
 * `model-tier.probe.mts` scores several models against the identical fixture.
 * `GEMINI_MODEL=<alias>` picks the model (config default otherwise).
 *
 * Baseline when this was written (landau.cubicsbms.com): 1 of 4.
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { HistoryModel } from '../src/models/History.model.js';
import { AiService } from '../src/services/ai.service.js';
import { activeModel, aiUsageSnapshot } from '../src/services/ai/client.js';
import type { AnalysisResult } from '@perfscope/shared';

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const WANT = args.find(a => !a.startsWith('--'));

await mongoose.connect(config.mongoUri);
const rows = await HistoryModel.find({ fullResult: { $ne: null } }).sort({ createdAt: -1 }).limit(40).lean();
await mongoose.disconnect();

// The newest audit with enough on it to have something specific to say. example.com is
// usually the newest row and has one request; it proves nothing.
const row = rows.find(x => {
  const r = x.fullResult as unknown as AnalysisResult;
  return (r.resources?.requests.length ?? 0) > 50 && (!WANT || r.url.includes(WANT));
});
if (!row) { console.error('No stored audit with >50 requests' + (WANT ? ` matching "${WANT}"` : '')); process.exit(1); }
const r = row.fullResult as unknown as AnalysisResult;

const startedAt = process.hrtime.bigint();
const analysis = await AiService.analysePage(r);
const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
if (!analysis) { console.error('analysePage returned null'); process.exit(1); }
const usage = aiUsageSnapshot()['page analysis'] ?? { calls: 0, cacheHits: 0, inTokens: 0, outTokens: 0, retries: 0, failures: 0 };

// ─── What a fix could legitimately cite ─────────────────────────────────────
const tail = (s: string) => s.split('/').pop()?.split('?')[0] ?? '';
const evidence = new Set<string>();
for (const q of r.resources?.requests ?? [])   { try { evidence.add(tail(new URL(q.url).pathname)); } catch { /* skip */ } }
for (const l of r.resources?.detectedLibraries ?? []) evidence.add(l.name);
for (const e of r.clsData?.elements ?? [])      evidence.add(e.selector.split(' > ').pop() ?? '');
for (const e of r.flameChartData?.events ?? []) if (e.isLongTask && e.url) evidence.add(tail(e.url));
for (const t of r.thirdParty ?? [])             evidence.add(t.name);
// Once audit details are kept (plan phase 1), their selectors count too.
for (const a of r.audits) for (const d of (a as { details?: { selector?: string }[] }).details ?? [])
  if (d.selector) evidence.add(d.selector.split(' > ').pop() ?? '');

const usable = [...evidence].filter(e => e.length > 3);

// ─── Score ──────────────────────────────────────────────────────────────────
console.log(`model ${activeModel()}  ·  ${(elapsedMs / 1000).toFixed(1)}s  ·  ${usage.inTokens} in / ${usage.outTokens} out tokens`);
console.log(`${r.url}  ·  perf ${r.scores.performance}  a11y ${r.scores.accessibility}  bp ${r.scores.bestPractices}  seo ${r.scores.seo}`);
console.log(`${usable.length} pieces of concrete evidence available to cite\n`);

let concrete = 0;
for (const fix of analysis.fixes) {
  const cites = usable.filter(e => fix.toLowerCase().includes(e.toLowerCase()));
  if (cites.length) concrete++;
  console.log(`  ${cites.length ? '●' : '○'} ${fix}`);
  console.log(`      ${cites.length ? `cites: ${[...new Set(cites)].slice(0, 3).join(', ')}` : 'generic — would fit any site'}`);
}

const auditsConcrete = Object.values(analysis.audits)
  .filter(t => usable.some(e => t.toLowerCase().includes(e.toLowerCase()))).length;

console.log(`\n  fixes concrete   : ${concrete} of ${analysis.fixes.length}`);
console.log(`  audits concrete  : ${auditsConcrete} of ${Object.keys(analysis.audits).length}`);
console.log(`\n  ${concrete >= Math.ceil(analysis.fixes.length * 0.75)
  ? 'PASS — three quarters or more of the fixes are about this page.'
  : `BELOW TARGET — plan phase 1 aims for ≥ ${Math.ceil(analysis.fixes.length * 0.75)} of ${analysis.fixes.length}.`}`);

if (AS_JSON) {
  console.log('##RESULT##' + JSON.stringify({
    model: activeModel(),
    url: r.url,
    fixes: analysis.fixes.length,
    concrete,
    auditsConcrete,
    auditsTotal: Object.keys(analysis.audits).length,
    diagnosisChars: analysis.diagnosis?.length ?? 0,
    elapsedMs: Math.round(elapsedMs),
    inTokens: usage.inTokens,
    outTokens: usage.outTokens,
  }));
}
