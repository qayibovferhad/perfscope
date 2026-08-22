/**
 * PLAN.md phase 5: is a stronger model worth it, measured rather than assumed.
 *
 * Everything runs on `gemini-flash-lite-latest` — the cheapest tier. The plan's rule is
 * that no model change ships without this table: same stored audit, same prompt, several
 * models, concreteness / latency / tokens side by side. If the number does not move,
 * stay on the cheap one.
 *
 *     npx tsx probes/model-tier.probe.mts [url-substring] [--runs N] [--models a,b,c]
 *
 * Each run is a fresh child process, which is deliberate: `generate()` caches by prompt,
 * so two runs of one model in one process would return the identical text and measure
 * nothing. The child is `ai-quality.probe.mts` — the scoring lives there once and this
 * file only tabulates, so the two probes can never drift into scoring differently.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnScored, mean, type ScoredRow } from './lib/repeat.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CHILD = join(here, 'ai-quality.probe.mts');

const args = process.argv.slice(2);
const flags = new Map<string, string>();
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a.startsWith('--')) flags.set(a, args[++i] ?? '');
  else positional.push(a);
}
const WANT = positional[0];
const RUNS = Math.max(1, parseInt(flags.get('--runs') ?? '2', 10) || 2);

/** Rolling aliases only — pinned versions get retired and 404 silently (see client.ts). */
const MODELS = (flags.get('--models') ?? 'gemini-flash-lite-latest,gemini-flash-latest,gemini-pro-latest').split(',');

type Row = ScoredRow;

const results = new Map<string, Row[]>();

for (const model of MODELS) {
  for (let run = 1; run <= RUNS; run++) {
    process.stdout.write(`· ${model} run ${run}/${RUNS} … `);
    const row = spawnScored(CHILD, WANT ? [WANT] : [], {
      cwd: join(here, '..'),
      env: { GEMINI_MODEL: model },
    });
    if (!row) continue;
    results.set(model, [...(results.get(model) ?? []), row]);
    console.log(`${row.concrete}/${row.fixes} concrete · ${(row.elapsedMs / 1000).toFixed(1)}s`);
  }
}

// ─── Table ────────────────────────────────────────────────────────────────────
const avg = mean;
const pad = (s: string, n: number) => s.padEnd(n);

console.log(`\nfixture: ${[...results.values()][0]?.[0]?.url ?? '(none)'}   ·   ${RUNS} run(s) per model\n`);
console.log(`  ${pad('model', 28)}${pad('fixes concrete', 16)}${pad('audits concrete', 17)}${pad('latency', 10)}tokens (in/out)`);
console.log('  ' + '─'.repeat(84));

for (const model of MODELS) {
  const rows = results.get(model);
  if (!rows?.length) { console.log(`  ${pad(model, 28)}no successful run`); continue; }
  const fixRatio = `${avg(rows.map(r => r.concrete)).toFixed(1)} of ${avg(rows.map(r => r.fixes)).toFixed(1)}`;
  const auditRatio = `${avg(rows.map(r => r.auditsConcrete)).toFixed(1)} of ${avg(rows.map(r => r.auditsTotal)).toFixed(1)}`;
  console.log(
    `  ${pad(model, 28)}${pad(fixRatio, 16)}${pad(auditRatio, 17)}` +
    `${pad(`${(avg(rows.map(r => r.elapsedMs)) / 1000).toFixed(1)}s`, 10)}` +
    `${Math.round(avg(rows.map(r => r.inTokens)))} / ${Math.round(avg(rows.map(r => r.outTokens)))}`,
  );
}

// The decision the table exists to make. Concreteness is the plan's metric; latency is
// the constraint, because analysePage runs while a person watches a skeleton.
const scored = MODELS
  .map(m => ({ m, rows: results.get(m) ?? [] }))
  .filter(x => x.rows.length)
  .map(x => ({
    model: x.m,
    rate: avg(x.rows.map(r => r.concrete / Math.max(1, r.fixes))),
    secs: avg(x.rows.map(r => r.elapsedMs)) / 1000,
  }));

const base = scored[0];
const best = [...scored].sort((a, b) => b.rate - a.rate)[0];
if (base && best) {
  const gain = (best.rate - base.rate) * 100;
  console.log(
    `\n  ${best.model === base.model || gain < 5
      ? `STAY on ${base.model} — no tier beats it by more than 5 points of concreteness.`
      : `${best.model} is +${gain.toFixed(0)} points concrete over ${base.model}, at ${(best.secs - base.secs).toFixed(1)}s more latency.`}`,
  );
}
