/**
 * Parses Chrome trace events from a Lighthouse run into FlameChartData.
 *
 * Flow:
 *  1. Identify renderer process (PID) + main thread (TID)
 *  2. Find navigationStart timestamp as the time origin
 *  3. Collect complete events (ph='X') with duration on main thread
 *  4. Categorise each event (scripting / rendering / painting / other)
 *  5. Compute call-stack depth via a time-ordered stack
 *  6. Trim to MAX_EVENTS, preferring long tasks and high-duration events
 */
import type { FlameChartData, FlameChartEvent } from '../types/index.js';

// ─── Category sets ────────────────────────────────────────────────────────────

const SCRIPTING = new Set([
  'FunctionCall', 'EvaluateScript', 'v8.execute', 'MajorGC', 'MinorGC',
  'V8.RunMicrotasks', 'RunMicrotasks', 'TimerFire', 'EventDispatch',
  'XHRLoad', 'XHRReadyStateChange', 'FireAnimationFrame', 'v8.callFunction',
  'V8.GCCompactor', 'ParseScript',
]);
const RENDERING = new Set([
  'Layout', 'UpdateLayerTree', 'RecalculateStyles', 'ParseHTML',
  'ParseCSS', 'StyleRecalc', 'InvalidateLayout', 'LayoutInvalidationTracking',
]);
const PAINTING = new Set([
  'Paint', 'CompositeLayers', 'RasterTask', 'GPUTask',
  'ImageDecodeTask', 'Decode Image', 'Resize Image',
]);

function categorise(name: string): FlameChartEvent['category'] {
  if (SCRIPTING.has(name) || /script|eval|gc|microtask|compile/i.test(name))  return 'scripting';
  if (RENDERING.has(name) || /layout|style|recalc|parsehtml/i.test(name))     return 'rendering';
  if (PAINTING.has(name)  || /paint|composite|raster|gpu/i.test(name))        return 'painting';
  return 'other';
}

// ─── Raw trace types (loose, Lighthouse doesn't export these) ─────────────────

type RawEvent = {
  cat?:  string;
  name:  string;
  ph:    string;
  ts:    number;          // microseconds
  dur?:  number;          // microseconds (only on ph='X')
  pid:   number;
  tid:   number;
  args?: Record<string, unknown>;
};

// ─── Main export ──────────────────────────────────────────────────────────────

const MAX_EVENTS = 3000;
const MIN_DUR_MS = 0.1;   // ignore sub-0.1 ms events

/**
 * @param traces  result.artifacts.traces (accessed via `any`)
 * @param maxMs   upper bound in ms (typically last filmstrip frame timing)
 */
/** Resolve traceEvents array regardless of shape.
 *  v12 : artifact IS the trace  { traceEvents: [...] }
 *  v10/11: artifacts.traces = { defaultPass: { traceEvents: [...] } } */
function resolveEvents(traces: unknown): RawEvent[] | undefined {
  if (!traces || typeof traces !== 'object') return undefined;
  const obj = traces as Record<string, unknown>;

  // Case 1 — direct trace object (Lighthouse v12 artifacts.Trace)
  if (Array.isArray(obj['traceEvents']) && (obj['traceEvents'] as unknown[]).length > 0) {
    return obj['traceEvents'] as RawEvent[];
  }

  // Case 2 — nested container (v10/v11 artifacts.traces.defaultPass etc.)
  for (const key of Object.keys(obj)) {
    const candidate = obj[key] as Record<string, unknown> | undefined;
    if (candidate && typeof candidate === 'object' &&
        Array.isArray(candidate['traceEvents']) &&
        (candidate['traceEvents'] as unknown[]).length > 0) {
      return candidate['traceEvents'] as RawEvent[];
    }
  }
  return undefined;
}

export function parseFlameChart(
  traces: unknown,
  maxMs: number,
): FlameChartData | null {
  try {
    const traceEvents = resolveEvents(traces);

    if (!Array.isArray(traceEvents) || traceEvents.length === 0) return null;

    // ── 1. Find renderer PID ──────────────────────────────────────────────────

    const navStartEvent = traceEvents.find(
      e => e.name === 'navigationStart' &&
           (e.cat?.includes('blink') || e.cat?.includes('devtools.timeline')),
    );

    // Fallback: most RunTask events → renderer main thread
    let rendererPid: number;
    if (navStartEvent) {
      rendererPid = navStartEvent.pid;
    } else {
      const pidCounts = new Map<number, number>();
      for (const e of traceEvents) {
        if (e.ph === 'X' && (e.name === 'RunTask' || e.name === 'Task') && e.dur && e.dur > 0) {
          pidCounts.set(e.pid, (pidCounts.get(e.pid) ?? 0) + 1);
        }
      }
      if (pidCounts.size === 0) return null;
      const top = [...pidCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!top) return null;
      rendererPid = top[0];
    }

    // ── 2. Find main thread TID ───────────────────────────────────────────────

    const threadNameEvt = traceEvents.find(
      e => e.pid === rendererPid &&
           e.name === 'thread_name' &&
           (e.args as Record<string, unknown>)?.name === 'CrRendererMain',
    );
    const mainTid = threadNameEvt?.tid;

    // ── 3. Navigation-start timestamp (µs) ───────────────────────────────────

    const navStartTs: number = navStartEvent?.ts ?? (() => {
      const mainEvents = traceEvents.filter(
        e => e.pid === rendererPid &&
             (mainTid == null || e.tid === mainTid) &&
             e.ph === 'X' && e.dur && e.dur > 0,
      );
      if (mainEvents.length === 0) return 0;
      return Math.min(...mainEvents.map(e => e.ts));
    })();

    // ── 4. Collect events ─────────────────────────────────────────────────────

    const raw: Array<Omit<FlameChartEvent, 'depth'>> = [];

    for (const e of traceEvents) {
      if (e.ph !== 'X' || !e.dur || e.dur <= 0)        continue;
      if (e.pid !== rendererPid)                         continue;
      if (mainTid != null && e.tid !== mainTid)          continue;

      const startMs  = (e.ts - navStartTs) / 1000;
      const durMs    = e.dur / 1000;

      if (startMs < -200 || startMs > maxMs + 3000)      continue;
      if (durMs < MIN_DUR_MS)                             continue;

      const args  = e.args as Record<string, unknown> | undefined;
      const data  = args?.data as Record<string, unknown> | undefined;
      const rawUrl = String(data?.url ?? data?.scriptName ?? args?.url ?? '');
      const url = rawUrl && rawUrl !== 'undefined' ? rawUrl : undefined;

      raw.push({
        name:       e.name,
        category:   categorise(e.name),
        startMs:    Math.max(0, startMs),
        durationMs: durMs,
        isLongTask: durMs >= 50,
        ...(url ? { url } : {}),
      });
    }

    if (raw.length === 0) return null;

    // ── 5. Trim to MAX_EVENTS (keep long tasks + highest-duration others) ─────

    raw.sort((a, b) => a.startMs - b.startMs || b.durationMs - a.durationMs);

    let trimmed: typeof raw;
    if (raw.length > MAX_EVENTS) {
      const longTasks = raw.filter(e => e.isLongTask);
      const rest = raw
        .filter(e => !e.isLongTask)
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, MAX_EVENTS - longTasks.length);
      trimmed = [...longTasks, ...rest].sort((a, b) => a.startMs - b.startMs);
    } else {
      trimmed = raw;
    }

    // ── 6. Compute call-stack depths ──────────────────────────────────────────

    const stack: number[] = [];   // endMs values of open frames
    const events: FlameChartEvent[] = trimmed.map(e => {
      // Pop frames that ended before this one starts
      while (stack.length > 0 && (stack[stack.length - 1] ?? 0) <= e.startMs) {
        stack.pop();
      }
      const depth = stack.length;
      stack.push(e.startMs + e.durationMs);
      return { ...e, depth };
    });

    const maxDepth   = events.reduce((m, e) => Math.max(m, e.depth),                   0);
    const durationMs = events.reduce((m, e) => Math.max(m, e.startMs + e.durationMs), 0);

    return { events, maxDepth, durationMs };
  } catch {
    return null;
  }
}
