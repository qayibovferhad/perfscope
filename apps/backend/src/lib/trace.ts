/**
 * Reading a Chrome trace: finding the events, and finding the renderer's main thread.
 *
 * Three parsers (flame chart, heap memory, interactions) each opened the trace the same
 * way and each carried its own copy of this. Not the worker, though — these run on the
 * main thread, called from lighthouse.service.ts, so the self-contained rule for
 * lighthouse.worker.ts does not reach here.
 *
 * What is deliberately *not* shared is what to do when a trace has no navigationStart.
 * The flame chart falls back to whichever process ran the most tasks; the interaction
 * parser gives up, because an interaction timeline with no zero point is meaningless.
 * That is policy, and it belongs with each parser.
 */

export interface RawTraceEvent {
  name:  string;
  ph:    string;
  /** Microseconds. */
  ts:    number;
  /** Microseconds; only on complete ('X') events. */
  dur?:  number;
  pid:   number;
  tid:   number;
  cat?:  string;
  args?: Record<string, unknown>;
}

/**
 * The trace artifact changed shape between Lighthouse versions: v12 hands over the trace
 * itself (`{ traceEvents }`), v10/v11 a container keyed by pass (`{ defaultPass: {...} }`).
 * Accepts either, and `undefined` when there is nothing usable.
 */
export function resolveTraceEvents(traces: unknown): RawTraceEvent[] | undefined {
  if (!traces || typeof traces !== 'object') return undefined;
  const obj = traces as Record<string, unknown>;

  const events = (v: unknown): RawTraceEvent[] | undefined => {
    const list = (v as Record<string, unknown> | undefined)?.['traceEvents'];
    return Array.isArray(list) && list.length > 0 ? (list as RawTraceEvent[]) : undefined;
  };

  return events(obj) ?? Object.values(obj).map(events).find(Boolean);
}

/** The navigationStart that marks t=0, or undefined on a trace that has none. */
export function findNavigationStart(events: RawTraceEvent[]): RawTraceEvent | undefined {
  return events.find(
    e => e.name === 'navigationStart' &&
         (e.cat?.includes('blink') || e.cat?.includes('devtools.timeline')),
  );
}

/**
 * The renderer's main thread id, from the thread_name event naming CrRendererMain.
 * Undefined means the trace never named it — callers treat that as "do not filter by
 * thread" rather than as an error, since the process is already the right one.
 */
export function findMainThreadTid(events: RawTraceEvent[], rendererPid: number): number | undefined {
  return events.find(
    e => e.pid === rendererPid &&
         e.name === 'thread_name' &&
         (e.args as Record<string, unknown> | undefined)?.['name'] === 'CrRendererMain',
  )?.tid;
}

/** Complete ('X') events with real duration, on the renderer's main thread. */
export function mainThreadEvents(
  events: RawTraceEvent[],
  rendererPid: number,
  mainTid: number | undefined,
): RawTraceEvent[] {
  return events.filter(
    e => e.ph === 'X' && e.dur !== undefined && e.dur > 0 &&
         e.pid === rendererPid &&
         (mainTid === undefined || e.tid === mainTid),
  );
}
