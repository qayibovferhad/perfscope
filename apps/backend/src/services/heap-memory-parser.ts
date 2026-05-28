/**
 * Parses Chrome trace UpdateCounters events to extract JS heap memory usage.
 *
 * Flow:
 *  1. Resolve traceEvents from whatever Lighthouse artifact shape is present
 *  2. Find navigationStart timestamp as the time origin
 *  3. Filter UpdateCounters events (ph='I') and extract jsHeapUsedSize
 *  4. Convert µs timestamps → ms, byte values → MB
 *  5. Detect GC events: drops ≥ GC_DROP_MB AND ≥ GC_DROP_PCT between samples
 *  6. Return { points, averageMb, peakMb }
 */

import type { HeapMemoryData, HeapMemoryPoint } from '../types/index.js';

const GC_DROP_MB  = 2;    // absolute drop threshold in MB
const GC_DROP_PCT = 0.10; // relative drop threshold (10 %)

type RawEvent = {
  name:  string;
  ph:    string;
  ts:    number;  // µs
  pid:   number;
  tid:   number;
  args?: Record<string, unknown>;
  cat?:  string;
};

// ─── Resolve traceEvents regardless of Lighthouse version shape ───────────────

function resolveEvents(traces: unknown): RawEvent[] | undefined {
  if (!traces || typeof traces !== 'object') return undefined;
  const obj = traces as Record<string, unknown>;

  // v12: artifact IS the trace { traceEvents: [...] }
  if (Array.isArray(obj['traceEvents']) && (obj['traceEvents'] as unknown[]).length > 0) {
    return obj['traceEvents'] as RawEvent[];
  }

  // v10/v11: { defaultPass: { traceEvents: [...] } }
  for (const key of Object.keys(obj)) {
    const candidate = obj[key] as Record<string, unknown> | undefined;
    if (
      candidate &&
      typeof candidate === 'object' &&
      Array.isArray(candidate['traceEvents']) &&
      (candidate['traceEvents'] as unknown[]).length > 0
    ) {
      return candidate['traceEvents'] as RawEvent[];
    }
  }
  return undefined;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseHeapMemory(traces: unknown): HeapMemoryData | null {
  try {
    const traceEvents = resolveEvents(traces);
    if (!Array.isArray(traceEvents) || traceEvents.length === 0) return null;

    // 1. Navigation-start timestamp (µs)
    const navStartEvent = traceEvents.find(
      e => e.name === 'navigationStart' &&
           (e.cat?.includes('blink') || e.cat?.includes('devtools.timeline')),
    );
    const navStartTs: number = navStartEvent?.ts ?? 0;

    // 2. Collect UpdateCounters events sorted by time
    const counterEvents = (traceEvents as RawEvent[])
      .filter(e => e.name === 'UpdateCounters' && (e.ph === 'I' || e.ph === 'i'))
      .sort((a, b) => a.ts - b.ts);

    if (counterEvents.length === 0) return null;

    // 3. Extract (timeMs, heapMb) pairs
    type RawPt = { timeMs: number; heapMb: number };
    const raw: RawPt[] = [];

    for (const e of counterEvents) {
      const data = e.args?.data as Record<string, unknown> | undefined;
      if (!data) continue;

      // Prefer args.data.ts as the user-facing timestamp when present
      const eventTs =
        (data['ts'] as number | undefined) ??
        (data['timestamp'] as number | undefined) ??
        e.ts;

      // Field name varies across Chrome versions
      const heapBytes =
        (data['jsHeapUsedSize']  as number | undefined) ??
        (data['jsHeapSizeUsed']  as number | undefined) ??
        (data['usedJSHeapSize']  as number | undefined);

      if (heapBytes == null || heapBytes <= 0) continue;

      const timeMs = (eventTs - navStartTs) / 1000;
      const heapMb  = heapBytes / (1024 * 1024);

      raw.push({ timeMs, heapMb });
    }

    if (raw.length === 0) return null;

    // 4. Detect GC events and build final points array
    const points: HeapMemoryPoint[] = raw.map((p, i) => {
      let isGC = false;
      if (i > 0) {
        const prev = raw[i - 1]!;
        const drop    = prev.heapMb - p.heapMb;
        const dropPct = prev.heapMb > 0 ? drop / prev.heapMb : 0;
        isGC = drop >= GC_DROP_MB && dropPct >= GC_DROP_PCT;
      }
      return { timeMs: p.timeMs, heapMb: p.heapMb, isGC };
    });

    // 5. Compute summary stats
    const heapValues = points.map(p => p.heapMb);
    const peakMb    = Math.max(...heapValues);
    const averageMb = heapValues.reduce((s, v) => s + v, 0) / heapValues.length;

    return { points, averageMb, peakMb };
  } catch {
    return null;
  }
}
