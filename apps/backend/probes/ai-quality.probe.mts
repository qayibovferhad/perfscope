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
 *     npx tsx probes/ai-quality.probe.mts [name-substring] [--runs N] [--limit N] [--json]
 *
 * Scores every fixture in `probes/fixtures/` — four deliberately unalike pages, so a
 * prompt that only helps heavy sites shows up as exactly that. Build the set with
 * `capture-fixtures.probe.mts`. With no fixtures on disk it falls back to the newest
 * substantial audit in the local database, which is what this measured before the set
 * existed: one site, changing under the metric every time an audit ran.
 *
 * **One run is a sample, not a measurement.** Measured: the same model over the same four
 * fixtures scored 13 of 19 and then 19 of 20, and nearly all of that swing came from the
 * one near-perfect page, where six citable facts mean a fix either happens to name the
 * logo file or does not. `--runs N` repeats the whole set in fresh processes (the prompt
 * cache lives in-process, so a repeat inside one would return the same text and measure
 * nothing) and reports the mean with its range — the same reason the product itself
 * reports a median of N Lighthouse runs and a spread instead of one number.
 *
 * `--json` prints one machine-readable `##RESULT##{…}` line, which is how
 * `model-tier.probe.mts` scores several models against the identical set.
 * `GEMINI_MODEL=<alias>` picks the model (config default otherwise).
 *
 * Baseline when this was written (landau.cubicsbms.com, single fixture): 1 of 4.
 */
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { HistoryModel } from '../src/models/History.model.js';
import { AiService } from '../src/services/ai.service.js';
import { activeModel, aiUsageSnapshot } from '../src/services/ai/client.js';
import { loadFixtures, type AiFixture } from './lib/aiFixture.mjs';
import { spawnScored, stats, mean } from './lib/repeat.mjs';
import type { AnalysisResult } from '@perfscope/shared';

const args = process.argv.slice(2);
const flags = new Map<string, string>();
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === '--limit' || a === '--runs') flags.set(a, args[++i] ?? '');
  else if (a.startsWith('--')) flags.set(a, '');
  else positional.push(a);
}
const AS_JSON = flags.has('--json');
const LIMIT = parseInt(flags.get('--limit') ?? '', 10) || Infinity;
const WANT = positional[0];
const RUNS = Math.max(1, parseInt(flags.get('--runs') ?? '1', 10) || 1);

// ─── Repeat mode: N fresh children, then the mean and the range ──────────────
if (RUNS > 1 && !AS_JSON) {
  const here = fileURLToPath(import.meta.url);
  const runs = [];
  for (let i = 1; i <= RUNS; i++) {
    process.stdout.write(`· run ${i}/${RUNS} … `);
    const row = spawnScored(here, [...(WANT ? [WANT] : []), ...(LIMIT === Infinity ? [] : ['--limit', String(LIMIT)])], { cwd: dirname(dirname(here)) });
    if (row) { runs.push(row); console.log(`${row.concrete} of ${row.fixes}`); }
  }
  if (runs.length === 0) { console.error('every run failed'); process.exit(1); }

  const names = [...new Set(runs.flatMap(r => (r.rows ?? []).map(x => x.name)))];
  console.log(`\n  ${'fixture'.padEnd(30)}${'citable'.padStart(8)}${'concrete'.padStart(14)}   range (${runs.length} runs)`);
  console.log('  ' + '─'.repeat(64));
  for (const name of names) {
    const mine = runs.flatMap(r => (r.rows ?? []).filter(x => x.name === name));
    const scoredRuns = mine.filter(x => x.fixes > 0);
    const quiet = mine.length - scoredRuns.length;
    if (scoredRuns.length === 0) {
      console.log(`  ${name.padEnd(30)}${String(mine[0]?.citable ?? 0).padStart(8)}${'silent'.padStart(14)}   ${quiet} of ${mine.length} runs`);
      continue;
    }
    const rate = stats(scoredRuns.map(x => x.concrete / x.fixes));
    console.log(`  ${name.padEnd(30)}${String(mine[0]?.citable ?? 0).padStart(8)}` +
      `${`${(rate.mean * 100).toFixed(0)}%`.padStart(14)}   ${(rate.min * 100).toFixed(0)}–${(rate.max * 100).toFixed(0)}%` +
      `${quiet ? `  (silent in ${quiet} of ${mine.length})` : ''}`);
  }
  const overall = stats(runs.filter(r => r.fixes > 0).map(r => r.concrete / r.fixes));
  console.log('  ' + '─'.repeat(64));
  console.log(`  ${'all fixtures'.padEnd(38)}${`${(overall.mean * 100).toFixed(0)}%`.padStart(14)}   ${(overall.min * 100).toFixed(0)}–${(overall.max * 100).toFixed(0)}%`);
  console.log(`  ${'mean latency per fixture'.padEnd(38)}${`${(mean(runs.map(r => r.elapsedMs)) / 1000).toFixed(1)}s`.padStart(14)}`);
  process.exit(0);
}

// ─── The pages under measurement ─────────────────────────────────────────────
let fixtures: AiFixture[] = loadFixtures(WANT).slice(0, LIMIT);
let source = `${fixtures.length} fixture(s) on disk`;

if (fixtures.length === 0) {
  await mongoose.connect(config.mongoUri);
  const rows = await HistoryModel.find({ fullResult: { $ne: null } }).sort({ createdAt: -1 }).limit(40).lean();
  await mongoose.disconnect();

  // The newest audit with enough on it to have something specific to say. example.com is
  // usually the newest row and has one request; it proves nothing.
  const row = rows.find(x => {
    const r = x.fullResult as unknown as AnalysisResult;
    return (r.resources?.requests.length ?? 0) > 50 && (!WANT || r.url.includes(WANT));
  });
  if (!row) {
    console.error(`No fixtures in probes/fixtures/ and no stored audit with >50 requests${WANT ? ` matching "${WANT}"` : ''}.`);
    console.error('Build the set first:  npx tsx probes/capture-fixtures.probe.mts');
    process.exit(1);
  }
  const result = row.fullResult as unknown as AnalysisResult;
  fixtures = [{ name: new URL(result.url).host, result }];
  source = 'the database (no fixtures on disk)';
}

// ─── What a fix could legitimately cite ──────────────────────────────────────
function evidenceIn(r: AnalysisResult): string[] {
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

  return [...evidence].filter(e => e.length > 3);
}

// ─── Score, one fixture at a time ────────────────────────────────────────────
// Sequential on purpose: four concurrent deep prompts is a burst the free tier answers
// with 503, and a fixture that failed for quota reasons would read as a quality drop.
interface Scored {
  name: string; url: string; fixes: number; concrete: number; citable: number;
  auditsConcrete: number; auditsTotal: number; diagnosisChars: number; elapsedMs: number;
}
const scored: Scored[] = [];

console.log(`model ${activeModel()}  ·  scoring ${source}\n`);

for (const { name, result } of fixtures) {
  const usable = evidenceIn(result);
  const startedAt = process.hrtime.bigint();
  const analysis = await AiService.analysePage(result).catch((err: unknown) => {
    console.log(`${name}\n  FAILED — ${String(err).slice(0, 120)}\n`);
    return null;
  });
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  if (!analysis) continue;

  console.log(`${name}  ·  perf ${result.scores.performance}  a11y ${result.scores.accessibility}` +
    `  bp ${result.scores.bestPractices}  seo ${result.scores.seo}  ·  ${usable.length} citable facts`);

  let concrete = 0;
  for (const fix of analysis.fixes) {
    const cites = usable.filter(e => fix.toLowerCase().includes(e.toLowerCase()));
    if (cites.length) concrete++;
    console.log(`  ${cites.length ? '●' : '○'} ${fix}`);
    console.log(`      ${cites.length ? `cites: ${[...new Set(cites)].slice(0, 3).join(', ')}` : 'generic — would fit any site'}`);
  }

  const auditsConcrete = Object.values(analysis.audits)
    .filter(t => usable.some(e => t.toLowerCase().includes(e.toLowerCase()))).length;
  console.log(analysis.fixes.length === 0
    // Not a zero score: a page with nothing material left is supposed to get no fixes, and
    // scoring that as 0% concrete would punish exactly the behaviour we asked for. It is
    // counted and shown instead, so a model that goes quiet everywhere is visible at once.
    ? `  → no fixes offered — the page had nothing material to fix, ${(elapsedMs / 1000).toFixed(1)}s\n`
    : `  → ${concrete} of ${analysis.fixes.length} fixes concrete, ` +
      `${auditsConcrete} of ${Object.keys(analysis.audits).length} audit notes, ${(elapsedMs / 1000).toFixed(1)}s\n`);

  scored.push({
    name, url: result.url, fixes: analysis.fixes.length, concrete, citable: usable.length, auditsConcrete,
    auditsTotal: Object.keys(analysis.audits).length,
    diagnosisChars: analysis.diagnosis?.length ?? 0, elapsedMs,
  });
}

if (scored.length === 0) { console.error('Every fixture failed — nothing to score.'); process.exit(1); }

// ─── The number ──────────────────────────────────────────────────────────────
const sum = (pick: (s: Scored) => number) => scored.reduce((a, s) => a + pick(s), 0);
const fixes = sum(s => s.fixes);
const concrete = sum(s => s.concrete);
const usage = aiUsageSnapshot()['page analysis'] ?? { calls: 0, cacheHits: 0, inTokens: 0, outTokens: 0, retries: 0, failures: 0 };

const silent = scored.filter(s => s.fixes === 0);

console.log('  ' + '─'.repeat(58));
for (const s of scored) {
  console.log(s.fixes === 0
    ? `  ${s.name.padEnd(34)}    silent — nothing material to fix`
    : `  ${s.name.padEnd(34)}${String(s.concrete).padStart(2)} of ${String(s.fixes).padEnd(3)} ` +
      `${((s.concrete / Math.max(1, s.fixes)) * 100).toFixed(0).padStart(4)}%`);
}
console.log('  ' + '─'.repeat(58));
console.log(`  ${`${scored.length - silent.length} scored fixture(s)`.padEnd(34)}${String(concrete).padStart(2)} of ${String(fixes).padEnd(3)} ` +
  `${((concrete / Math.max(1, fixes)) * 100).toFixed(0).padStart(4)}%`);
if (silent.length) console.log(`  ${'silent'.padEnd(34)}${String(silent.length).padStart(2)} of ${scored.length} fixture(s)`);
console.log(`  ${'audit notes'.padEnd(34)}${String(sum(s => s.auditsConcrete)).padStart(2)} of ${String(sum(s => s.auditsTotal)).padEnd(3)}`);
console.log(`  ${'tokens'.padEnd(34)}${usage.inTokens} in / ${usage.outTokens} out` +
  `${usage.retries || usage.failures ? `, ${usage.retries} retried / ${usage.failures} failed` : ''}`);

const target = Math.ceil(fixes * 0.75);
console.log(`\n  ${concrete >= target
  ? 'PASS — three quarters or more of the fixes are about the page they were written for.'
  : `BELOW TARGET — plan phase 1 aims for ≥ ${target} of ${fixes}.`}`);

if (AS_JSON) {
  console.log('##RESULT##' + JSON.stringify({
    model: activeModel(),
    url: scored.length === 1 ? scored[0]!.url : `${scored.length} fixtures`,
    fixtures: scored.length,
    silent: silent.length,
    fixes,
    concrete,
    auditsConcrete: sum(s => s.auditsConcrete),
    auditsTotal:    sum(s => s.auditsTotal),
    diagnosisChars: Math.round(sum(s => s.diagnosisChars) / scored.length),
    elapsedMs:      Math.round(sum(s => s.elapsedMs) / scored.length),
    inTokens:  usage.inTokens,
    outTokens: usage.outTokens,
    rows: scored.map(s => ({ name: s.name, fixes: s.fixes, concrete: s.concrete, citable: s.citable })),
  }));
}
