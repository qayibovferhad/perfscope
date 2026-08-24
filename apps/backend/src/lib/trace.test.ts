import { describe, it, expect } from 'vitest';
import {
  resolveTraceEvents,
  findNavigationStart,
  findMainThreadTid,
  mainThreadEvents,
  type RawTraceEvent,
} from './trace.js';

const ev = (over: Partial<RawTraceEvent> = {}): RawTraceEvent =>
  ({ name: 'Task', ph: 'X', ts: 1_000, dur: 5_000, pid: 7, tid: 3, cat: 'devtools.timeline', ...over });

/** An event that never carried a duration at all — not one carrying `undefined`, which is
 *  a different thing under `exactOptionalPropertyTypes` and not what a trace produces. */
const noDur = (over: Partial<RawTraceEvent> = {}): RawTraceEvent => {
  const { dur: _dur, ...rest } = ev(over);
  return rest as RawTraceEvent;
};

describe('resolveTraceEvents', () => {
  it('reads the Lighthouse 12 shape — the trace itself', () => {
    const events = [ev()];
    expect(resolveTraceEvents({ traceEvents: events })).toBe(events);
  });

  it('reads the older per-pass container', () => {
    // v10/v11 hand over `{ defaultPass: { traceEvents } }`. Both shapes have to keep
    // working: a stored artifact may predate the upgrade.
    const events = [ev()];
    expect(resolveTraceEvents({ defaultPass: { traceEvents: events } })).toBe(events);
  });

  it('skips a pass that carries no events and takes the one that does', () => {
    const events = [ev()];
    expect(resolveTraceEvents({ emptyPass: { traceEvents: [] }, defaultPass: { traceEvents: events } })).toBe(events);
  });

  it('is undefined for anything unusable', () => {
    for (const junk of [undefined, null, 'trace', 42, {}, { traceEvents: [] }, { pass: {} }]) {
      expect(resolveTraceEvents(junk)).toBeUndefined();
    }
  });
});

describe('findNavigationStart', () => {
  it('finds the blink/devtools navigationStart that marks t=0', () => {
    const nav = ev({ name: 'navigationStart', ph: 'R', cat: 'blink.user_timing', ts: 500 });
    expect(findNavigationStart([ev(), nav])).toBe(nav);
  });

  it('ignores a navigationStart from an unrelated category', () => {
    // Same name, different instrumentation — using it as the zero point shifts every
    // timestamp in the flame chart.
    const other = ev({ name: 'navigationStart', cat: 'loading' });
    expect(findNavigationStart([other])).toBeUndefined();
  });

  it('is undefined when the trace has none — the callers own that policy', () => {
    expect(findNavigationStart([ev()])).toBeUndefined();
  });
});

describe('findMainThreadTid', () => {
  const nameEvent = (pid: number, tid: number, name: string): RawTraceEvent =>
    ev({ name: 'thread_name', ph: 'M', pid, tid, args: { name } });

  it('finds CrRendererMain within the given process', () => {
    const events = [nameEvent(7, 1, 'Compositor'), nameEvent(7, 3, 'CrRendererMain')];
    expect(findMainThreadTid(events, 7)).toBe(3);
  });

  it('ignores CrRendererMain belonging to another process', () => {
    // A trace holds every renderer the browser had open; picking another tab's main thread
    // produces a flame chart of somebody else's page.
    expect(findMainThreadTid([nameEvent(99, 3, 'CrRendererMain')], 7)).toBeUndefined();
  });
});

describe('mainThreadEvents', () => {
  it('keeps only complete events with real duration on the main thread', () => {
    const events = [
      ev({ name: 'keep', pid: 7, tid: 3 }),
      ev({ name: 'instant', ph: 'I', pid: 7, tid: 3 }),
      ev({ name: 'zero-length', pid: 7, tid: 3, dur: 0 }),
      noDur({ name: 'no-duration', pid: 7, tid: 3 }),
      ev({ name: 'other-thread', pid: 7, tid: 4 }),
      ev({ name: 'other-process', pid: 8, tid: 3 }),
    ];
    expect(mainThreadEvents(events, 7, 3).map(e => e.name)).toEqual(['keep']);
  });

  it('does not filter by thread when the trace never named one', () => {
    // Undefined means "the trace did not say", not "no thread matches" — the process is
    // already the right one, so dropping everything would be the wrong degradation.
    const events = [ev({ tid: 3 }), ev({ tid: 4 })];
    expect(mainThreadEvents(events, 7, undefined)).toHaveLength(2);
  });
});
