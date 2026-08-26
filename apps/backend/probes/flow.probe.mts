/**
 * A user flow, end to end, against a page built to misbehave.
 *
 * The point of the feature is measuring what a cold load cannot see, so the fixture serves
 * a button whose handler blocks the main thread for 300ms and then reveals a panel. A
 * navigation audit of that page reports a fast, clean load — which is true and useless. The
 * flow has to report the 300ms.
 *
 * Serves its own fixture, so nothing depends on a site staying broken (the same reason
 * `e2e/fixtures/inaccessible.html` exists).
 *
 *   cd apps/backend && npx tsx probes/flow.probe.mts
 */
import { createServer } from 'node:http';
import { runFlow } from '../src/services/flow.service.js';
import type { FlowStep } from '@perfscope/shared';

const PORT = 3406;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Flow probe</title>
<style>body{font:16px system-ui;margin:2rem}#panel{display:none;height:200px;background:#eee}
button{padding:.6rem 1rem}</style></head>
<body>
  <h1>Flow probe</h1>
  <button id="open">Open panel</button>
  <div id="panel">Panel content</div>
  <img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">
  <script>
    document.getElementById('open').addEventListener('click', () => {
      const until = performance.now() + 300;
      while (performance.now() < until) {}          // block the main thread
      document.getElementById('panel').style.display = 'block';
    });
  </script>
</body></html>`;

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
});
await new Promise<void>((resolve) => server.listen(PORT, resolve));

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

const steps: FlowStep[] = [
  { action: 'click', selector: '#open', name: 'Open the panel' },
  { action: 'waitFor', selector: '#panel', measure: false },
];

try {
  const progress: string[] = [];
  const started = Date.now();

  const result = await runFlow(
    { name: 'Probe flow', url: `http://localhost:${PORT}/`, steps, snapshotAtEnd: true, formFactor: 'desktop' },
    { onProgress: (p) => progress.push(`${p.percent}% ${p.message}`) },
  );

  console.log(`\n  ran in ${Math.round((Date.now() - started) / 1000)}s, ${result.steps.length} steps\n`);
  for (const step of result.steps) {
    console.log(`  — ${step.name} [${step.mode}] scores=${JSON.stringify(step.scores)} metrics=${JSON.stringify(step.metrics)} audits=${step.audits.length}`);
  }
  console.log('');

  // ─── Shape ─────────────────────────────────────────────────────────────────
  // Navigation + one measured step + snapshot. The unmeasured `waitFor` is plumbing and
  // must not appear as a step of its own, or the report claims to have measured a wait.
  check(result.steps.length === 3, `three measured steps, not one per definition step (${result.steps.length})`);
  check(result.steps.map(s => s.mode).join(',') === 'navigation,timespan,snapshot',
    `modes in order (${result.steps.map(s => s.mode).join(',')})`);

  // ─── The number a cold load cannot produce ─────────────────────────────────
  const timespan = result.steps.find(s => s.mode === 'timespan')!;
  console.log(`  INP on the click: ${timespan.metrics.inp}ms\n`);
  check(typeof timespan.metrics.inp === 'number', 'the interaction reports INP at all');
  check((timespan.metrics.inp ?? 0) > 200,
    `and reports the 300ms the handler blocks for (${Math.round(timespan.metrics.inp ?? 0)}ms)`);
  check(timespan.name === 'Open the panel', 'named as the definition named it');
  check(timespan.action === 'Open the panel', 'carrying what it did, so the report reads alone');

  // ─── Each mode reports only what it measured ───────────────────────────────
  // The trap this guards: Lighthouse gives a snapshot `performance: 0` because it has no
  // timing to score, and a report that prints it says the page scored zero.
  const snapshot = result.steps.find(s => s.mode === 'snapshot')!;
  check(snapshot.scores.performance === undefined, 'a snapshot reports no performance score');
  check(Object.keys(snapshot.metrics).length === 0, 'and no timing at all');
  check(typeof snapshot.scores.accessibility === 'number', 'but does score accessibility — the reason to take one');

  check(timespan.metrics.lcp === undefined, 'a timespan reports no LCP — nothing was loading');
  const navigation = result.steps[0]!;
  check(typeof navigation.metrics.lcp === 'number', 'while the navigation does');
  check(typeof navigation.scores.performance === 'number', 'with a performance score');

  // ─── Progress is step-shaped ───────────────────────────────────────────────
  check(progress.length >= 3, `progress reported per step (${progress.length} events)`);
  check(progress.every(p => Number(p.split('%')[0]) <= 99), 'never claiming 100% before the result exists');

  // ─── A step that cannot run says which one ─────────────────────────────────
  const broken = await runFlow(
    {
      name: 'Broken flow', url: `http://localhost:${PORT}/`, snapshotAtEnd: false, formFactor: 'desktop',
      steps: [{ action: 'click', selector: '#does-not-exist', name: 'Click a ghost' }],
    },
  ).then(() => null).catch((err: Error & { step?: number }) => err);

  check(broken !== null, 'a selector that never appears fails the flow');
  check(/Step 1 \(Click a ghost\)/.test(broken?.message ?? ''), `naming the step (${broken?.message?.slice(0, 60)})`);
  check(broken?.step === 0, 'and its index, so the editor can point at the row');
} finally {
  server.close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
