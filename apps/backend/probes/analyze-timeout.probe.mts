/**
 * Probe: does POST /api/analyze survive a page that takes longer than the server's
 * global 70-second request timeout?
 *
 * `httpServer.setTimeout(70s)` is server-wide while an audit is allowed four minutes, so a
 * slow site used to have its connection cut while the audit carried on server-side — the
 * caller saw a failure for a run that succeeded, and retrying started a second audit
 * competing for the same CPU. The route now raises the limit for its own connection.
 *
 * Getting a single audit past 70 s is awkward — Lighthouse aborts a page that will not
 * finish loading. The queue is the realistic route, and the one that actually bit: once the
 * concurrency cap is reached a caller waits for the audits ahead of it *plus* its own. So
 * this fires one more audit than `MAX_CONCURRENT_AUDITS` (default 2) and watches the last,
 * which cannot start until one of the others finishes.
 *
 * Needs a backend on 3199, so the dev server is left alone:
 *
 *     PORT=3199 npx tsx src/index.ts &
 *     npx tsx probes/analyze-timeout.probe.mts
 */
const BACKEND = process.env['E2E_BACKEND_URL'] ?? 'http://localhost:3199';
const TARGET  = process.argv[2] ?? 'https://www.bbc.com';

const started = Date.now();
const at = (t: number) => `${((t - started) / 1000).toFixed(0)}s`;

async function analyze(label: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BACKEND}/api/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url: TARGET }),
    });
    const body = await res.json() as {
      success?: boolean;
      data?: { result?: { scores?: Record<string, number> } };
      error?: string;
    };
    return {
      label,
      elapsed: (Date.now() - t0) / 1000,
      status:  res.status,
      score:   body.data?.result?.scores?.['performance'],
      error:   body.error,
      finished: at(Date.now()),
    };
  } catch (err) {
    return { label, elapsed: (Date.now() - t0) / 1000, status: 0, error: (err as Error).message, finished: at(Date.now()) };
  }
}

const CAP = Number(process.env['MAX_CONCURRENT_AUDITS'] ?? 2);
const COUNT = CAP + 1;

console.log(`${COUNT} concurrent audits of ${TARGET} through ${BACKEND}/api/analyze`);
console.log(`at a cap of ${CAP}, the last one queues — the old cutoff was 70s\n`);

const runs = [];
for (let i = 0; i < COUNT; i++) {
  runs.push(analyze(i === COUNT - 1 ? 'queued' : `run ${i + 1}`));
  // Stagger slightly so the queue order is deterministic.
  await new Promise((r) => setTimeout(r, 500));
}

const results = await Promise.all(runs);
for (const r of results) {
  console.log(`  ${r.label.padEnd(7)} ${String(r.status).padStart(3)}  took ${r.elapsed.toFixed(0)}s, done at ${r.finished}` +
    `  score ${r.score ?? '—'}${r.error ? `  error: ${r.error}` : ''}`);
}

const s = results[results.length - 1]!;
console.log(s.elapsed > 70 && s.status === 200
  ? `\n  PASS — the queued caller held its connection ${s.elapsed.toFixed(0)}s, past the 70s server timeout, and got its result.`
  : s.elapsed <= 70
    ? `\n  INCONCLUSIVE — the second audit finished in ${s.elapsed.toFixed(0)}s, inside the old cutoff, so nothing was proven.`
    : `\n  FAIL — waited ${s.elapsed.toFixed(0)}s and did not come back cleanly (HTTP ${s.status}).`);
