/**
 * Characterisation harness for the three trace parsers.
 *
 * Feeds them synthetic traces covering every shape they branch on — both artifact layouts
 * Lighthouse has used, a trace with no navigationStart, one with no thread_name, and the
 * junk inputs the resolver has to reject — and prints a stable digest of what each
 * returns. Diff the output across a change: it must not move.
 *
 * There is no test runner in this package, so this is run by hand:
 *
 *     cd apps/backend && npx tsx probes/trace-parsers.mts > before.txt
 *     ...make the change...
 *     npx tsx probes/trace-parsers.mts | diff before.txt -
 *
 * A live audit cannot do this job. It exercises one trace shape, and none of the
 * navigation-start or thread-name fallbacks that the parsers disagree about on purpose:
 * the flame chart falls back to the busiest process, the interaction parser gives up.
 */
import { parseFlameChart } from '../src/services/flame-chart-parser.js';
import { parseHeapMemory } from '../src/services/heap-memory-parser.js';
import { parseInteractions } from '../src/services/interaction-parser.js';

const PID = 42, TID = 7, T0 = 1_000_000;

const navStart = { name: 'navigationStart', ph: 'R', ts: T0, pid: PID, tid: TID, cat: 'blink.user_timing' };
const threadName = { name: 'thread_name', ph: 'M', ts: T0, pid: PID, tid: TID, args: { name: 'CrRendererMain' } };

/** Complete main-thread events at a few depths, plus one on another thread that must be ignored. */
const work = [
  { name: 'RunTask',       ph: 'X', ts: T0 +  1_000, dur: 120_000, pid: PID, tid: TID, cat: 'devtools.timeline' },
  { name: 'FunctionCall',  ph: 'X', ts: T0 +  5_000, dur:  60_000, pid: PID, tid: TID, cat: 'devtools.timeline' },
  { name: 'ParseHTML',     ph: 'X', ts: T0 + 200_000, dur: 40_000, pid: PID, tid: TID, cat: 'devtools.timeline' },
  { name: 'Layout',        ph: 'X', ts: T0 + 300_000, dur: 90_000, pid: PID, tid: TID, cat: 'devtools.timeline' },
  { name: 'RunTask',       ph: 'X', ts: T0 + 500_000, dur: 250_000, pid: PID, tid: TID, cat: 'devtools.timeline' },
  { name: 'OtherThread',   ph: 'X', ts: T0 + 10_000, dur: 500_000, pid: PID, tid: 99, cat: 'devtools.timeline' },
];

const heap = [0, 1, 2, 3, 4].map(i => ({
  name: 'UpdateCounters', ph: 'I', ts: T0 + i * 100_000, pid: PID, tid: TID,
  cat: 'disabled-by-default-devtools.timeline',
  // A deliberate drop between samples 2 and 3 to exercise GC detection.
  args: { data: { jsHeapUsedSize: [10, 20, 30, 5, 12][i]! * 1024 * 1024 } },
}));

const interactions = [
  { name: 'EventDispatch', ph: 'X', ts: T0 + 400_000, dur: 180_000, pid: PID, tid: TID,
    cat: 'devtools.timeline', args: { data: { type: 'click' } } },
  { name: 'EventDispatch', ph: 'X', ts: T0 + 700_000, dur: 40_000, pid: PID, tid: TID,
    cat: 'devtools.timeline', args: { data: { type: 'keydown' } } },
];

const allEvents = [navStart, threadName, ...work, ...heap, ...interactions];

/** The artifact shapes the resolver is supposed to accept, plus ones it must reject. */
const CASES: Record<string, unknown> = {
  'v12 direct { traceEvents }':      { traceEvents: allEvents },
  'v10/11 nested defaultPass':       { defaultPass: { traceEvents: allEvents } },
  'nested under another pass name':  { somePass: { traceEvents: allEvents } },
  'empty traceEvents':               { traceEvents: [] },
  'no navigationStart':              { traceEvents: allEvents.filter(e => e.name !== 'navigationStart') },
  'no thread_name':                  { traceEvents: allEvents.filter(e => e.name !== 'thread_name') },
  'null':                            null,
  'not an object':                   'nope',
  'object with nothing usable':      { foo: 1 },
};

const digest = (v: unknown) => JSON.stringify(v, (_k, val) =>
  typeof val === 'number' ? Math.round(val * 1000) / 1000 : val);

for (const [label, artifact] of Object.entries(CASES)) {
  console.log(`\n── ${label} ──`);
  const fc = parseFlameChart(artifact, 1000);
  const hm = parseHeapMemory(artifact);
  const ix = parseInteractions(artifact);
  console.log('  flame       :', fc ? digest({ n: fc.events.length, total: fc.totalDurationMs, cats: [...new Set(fc.events.map(e => e.category))].sort(), depths: [...new Set(fc.events.map(e => e.depth))].sort(), first: fc.events[0] }) : 'null');
  console.log('  heap        :', hm ? digest({ n: hm.points.length, avg: hm.averageMb, peak: hm.peakMb, gc: hm.points.filter(p => p.isGc).length }) : 'null');
  console.log('  interactions:', ix ? digest({ n: ix.events.length, inp: ix.inpMs, tbt: ix.totalBlockingTimeMs, tasks: ix.longTasks.length }) : 'null');
}
