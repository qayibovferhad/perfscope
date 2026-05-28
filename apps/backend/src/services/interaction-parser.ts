/**
 * Parses Chrome trace EventDispatch events to compute interaction responsiveness metrics.
 *
 * Lighthouse traces don't contain real user clicks — instead we capture ALL
 * EventDispatch events (load, DOMContentLoaded, readystatechange, scroll, etc.)
 * that fired on the main thread, which still represent handler execution cost.
 * User-initiated types (click, keydown…) are flagged separately when present.
 *
 * Flow:
 *  1. Identify renderer PID + main thread TID + navigationStart origin
 *  2. Collect ALL EventDispatch events with a meaningful duration (≥ 0.5ms)
 *  3. For each: estimate Input Delay from overlapping long tasks,
 *     set Processing Time = EventDispatch duration, find deepest blocking function
 *  4. Mark the highest-latency interaction as INP
 */
import type { InteractionData, InteractionEvent } from '../types/index.js';

const USER_INPUT_TYPES = new Set([
  'click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup',
  'keydown', 'keyup', 'keypress', 'touchstart', 'touchend',
]);

// Minimum EventDispatch duration to consider (µs). Filters out trivial no-op handlers.
const MIN_DISPATCH_US = 500;

type RawEvent = {
  name:  string;
  ph:    string;
  ts:    number;
  dur?:  number;
  pid:   number;
  tid:   number;
  cat?:  string;
  args?: Record<string, unknown>;
};

function resolveEvents(traces: unknown): RawEvent[] | undefined {
  if (!traces || typeof traces !== 'object') return undefined;
  const obj = traces as Record<string, unknown>;
  if (Array.isArray(obj['traceEvents']) && (obj['traceEvents'] as unknown[]).length > 0) {
    return obj['traceEvents'] as RawEvent[];
  }
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

export function parseInteractions(traces: unknown): InteractionData | null {
  try {
    const traceEvents = resolveEvents(traces);
    if (!Array.isArray(traceEvents) || traceEvents.length === 0) return null;

    // ── 1. Find renderer PID + navigationStart ────────────────────────────────

    const navStartEvent = traceEvents.find(
      e => e.name === 'navigationStart' &&
           (e.cat?.includes('blink') || e.cat?.includes('devtools.timeline')),
    );
    if (!navStartEvent) return null;

    const rendererPid = navStartEvent.pid;
    const navStartTs  = navStartEvent.ts;

    // Find main thread TID
    const threadNameEvt = traceEvents.find(
      e => e.pid === rendererPid &&
           e.name === 'thread_name' &&
           (e.args as Record<string, unknown>)?.name === 'CrRendererMain',
    );
    const mainTid = threadNameEvt?.tid;

    // ── 2. Collect main-thread complete events ─────────────────────────────────

    const mainEvents = traceEvents.filter(e =>
      e.ph === 'X' && e.dur && e.dur > 0 &&
      e.pid === rendererPid &&
      (mainTid == null || e.tid === mainTid),
    );

    // Long tasks: > 50ms duration on main thread
    const longTasks = mainEvents
      .filter(e => (e.dur ?? 0) >= 50_000)
      .map(e => ({ startTs: e.ts, endTs: e.ts + (e.dur ?? 0), durationMs: (e.dur ?? 0) / 1000 }));

    // Paint events for presentation delay (next frame after event ends)
    const paintEvents = mainEvents
      .filter(e => e.name === 'Paint' || e.name === 'CompositeLayers' || e.name === 'Commit')
      .sort((a, b) => a.ts - b.ts);

    // ── 3. Collect ALL EventDispatch events with meaningful duration ────────────
    // Lighthouse traces rarely have real user clicks — page lifecycle events
    // (load, DOMContentLoaded, scroll, readystatechange…) are captured instead.

    const dispatchEvents = mainEvents.filter(e =>
      e.name === 'EventDispatch' && (e.dur ?? 0) >= MIN_DISPATCH_US,
    );

    if (dispatchEvents.length === 0) return null;

    // ── 4. TBT: sum of blocking portions (over 50ms) across all long tasks ────

    const totalBlockingTimeMs = longTasks.reduce((sum, lt) => sum + Math.max(0, lt.durationMs - 50), 0);

    // ── 5. Build InteractionEvent for each dispatch ────────────────────────────

    const interactions: InteractionEvent[] = dispatchEvents.map((e, i) => {
      const data          = (e.args as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      const type          = String(data?.type ?? 'unknown');
      const startMs       = Math.max(0, (e.ts - navStartTs) / 1000);
      const processingMs  = (e.dur ?? 0) / 1000;

      // Input Delay: find long tasks that were running right before this event started.
      // Overlapping task (started before event, still running when event fired) → blocked
      // task that ended just before (< 100ms gap) → also counted
      let inputDelayMs = 0;
      for (const lt of longTasks) {
        if (lt.startTs < e.ts && lt.endTs > e.ts) {
          // Task overlapped event start
          inputDelayMs = Math.max(inputDelayMs, (e.ts - lt.startTs) / 1000);
        } else if (lt.endTs <= e.ts && e.ts - lt.endTs < 100_000) {
          // Task ended within 100ms before event
          inputDelayMs = Math.max(inputDelayMs, lt.durationMs);
        }
      }

      // Target element: reconstruct selector from trace data
      const tagName     = String(data?.targetName ?? data?.nodeName ?? '').toUpperCase() || 'UNKNOWN';
      const targetId    = String(data?.targetId ?? '').trim();
      const rawClass    = String(data?.targetClass ?? data?.className ?? '').trim();
      const firstClass  = rawClass.split(/\s+/).filter(Boolean)[0] ?? '';
      const targetElement = [
        tagName,
        targetId    ? `#${targetId}`    : '',
        firstClass  ? `.${firstClass}`  : '',
      ].filter(Boolean).join('') || 'unknown';

      // Blocking function: find the longest-running FunctionCall inside this EventDispatch
      const eventEndTs = e.ts + (e.dur ?? 0);
      let blockingFunctionName: string | null = null;
      let bestDur = 0;

      for (const candidate of mainEvents) {
        if (candidate.name !== 'FunctionCall' && candidate.name !== 'EvaluateScript' && candidate.name !== 'v8.execute') continue;
        if (candidate.ts < e.ts || candidate.ts >= eventEndTs) continue;
        const dur = candidate.dur ?? 0;
        if (dur <= bestDur) continue;

        const cArgs = candidate.args as Record<string, unknown> | undefined;
        const cData = cArgs?.data as Record<string, unknown> | undefined;
        const fnName = String(
          cData?.functionName ??
          cData?.scriptName ??
          cData?.url ??
          cArgs?.url ??
          '',
        ).trim();

        if (fnName && fnName !== 'undefined') {
          bestDur = dur;
          try {
            const url = new URL(fnName);
            blockingFunctionName = url.pathname.split('/').at(-1) ?? fnName;
          } catch {
            blockingFunctionName = fnName;
          }
        }
      }

      // Presentation Delay: time from end of processing to the next paint
      const nextPaint  = paintEvents.find(p => p.ts >= eventEndTs);
      const presentationDelayMs = nextPaint
        ? Math.min(Math.max(0, (nextPaint.ts - eventEndTs) / 1000), 100)
        : 16;  // fallback: one frame at 60fps

      return {
        id:                   `interaction-${i}`,
        type,
        startMs,
        inputDelayMs,
        processingTimeMs:     processingMs,
        presentationDelayMs,
        totalDurationMs:      inputDelayMs + processingMs + presentationDelayMs,
        targetElement,
        blockingFunctionName,
        isUserInput:          USER_INPUT_TYPES.has(type),
        isINP:                false,
      };
    });

    if (interactions.length === 0) return null;

    // ── 6. Mark INP (highest totalDurationMs) ─────────────────────────────────

    let inpMs   = 0;
    let inpIdx  = 0;
    for (let i = 0; i < interactions.length; i++) {
      const dur = interactions[i]?.totalDurationMs ?? 0;
      if (dur > inpMs) { inpMs = dur; inpIdx = i; }
    }
    if (interactions[inpIdx]) interactions[inpIdx]!.isINP = true;

    const avgInputDelayMs = interactions.reduce((s, ev) => s + ev.inputDelayMs, 0) / interactions.length;

    // Annotate each long task with the heaviest function running inside it
    const TASK_WRAPPERS = new Set(['RunTask', 'Task', 'TaskQueueManager::ProcessTaskFromWorkQueue', 'ThreadControllerImpl::RunTask']);
    const longTaskSegments = longTasks.map(lt => {
      let topFunctionName: string | undefined;
      let bestDur = 0;
      for (const ev of mainEvents) {
        if (ev.ts < lt.startTs || ev.ts >= lt.endTs) continue;
        if (TASK_WRAPPERS.has(ev.name)) continue;
        const dur = ev.dur ?? 0;
        if (dur <= bestDur) continue;
        const evArgs = ev.args as Record<string, unknown> | undefined;
        const evData = evArgs?.data as Record<string, unknown> | undefined;
        const raw = String(evData?.functionName ?? evData?.url ?? evData?.scriptName ?? evArgs?.url ?? ev.name).trim();
        if (!raw || raw === 'undefined') continue;
        bestDur = dur;
        try {
          topFunctionName = new URL(raw).pathname.split('/').at(-1) ?? raw;
        } catch {
          topFunctionName = raw;
        }
      }
      return {
        startMs:    Math.max(0, (lt.startTs - navStartTs) / 1000),
        durationMs: lt.durationMs,
        ...(topFunctionName ? { topFunctionName } : {}),
      };
    });

    return { events: interactions, longTasks: longTaskSegments, inpMs, avgInputDelayMs, totalBlockingTimeMs };
  } catch {
    return null;
  }
}
