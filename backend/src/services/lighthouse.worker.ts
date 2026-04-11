import { workerData, parentPort } from 'worker_threads';
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import type { RunnerResult } from 'lighthouse';

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

interface WorkerInput { url: string; categories: string[] }

// Compact trace sent back to the service so parseFlameChart can run there
// (avoids worker-thread module-resolution issues with tsx's .js→.ts remapping)
type CompactTrace = { defaultPass: { traceEvents: unknown[] } };

type WorkerMessage =
  | { type: 'result'; lhr: RunnerResult['lhr']; compactTrace?: CompactTrace; traceMaxMs?: number }
  | { type: 'error'; message: string };

/** Resolve traceEvents from whatever shape Lighthouse provides.
 *  v12 : artifacts.Trace  = { traceEvents: [...] }   ← direct
 *  v10/11: artifacts.traces = { defaultPass: { traceEvents: [...] } } ← nested */
function resolveTraceEvents(traces: unknown): unknown[] | undefined {
  if (!traces || typeof traces !== 'object') return undefined;
  const obj = traces as Record<string, unknown>;

  // Case 1: the object IS the trace (Lighthouse v12 artifacts.Trace)
  if (Array.isArray(obj['traceEvents']) && (obj['traceEvents'] as unknown[]).length > 0) {
    return obj['traceEvents'] as unknown[];
  }

  // Case 2: nested container { defaultPass: { traceEvents } } (v10/v11)
  for (const key of Object.keys(obj)) {
    const candidate = obj[key] as Record<string, unknown> | undefined;
    if (candidate && typeof candidate === 'object' &&
        Array.isArray(candidate['traceEvents']) &&
        (candidate['traceEvents'] as unknown[]).length > 0) {
      return candidate['traceEvents'] as unknown[];
    }
  }
  return undefined;
}

/**
 * Pre-filter the trace inside the worker so we only send a small fraction of
 * the raw trace events over the postMessage channel.
 * Keeps: ph='X' complete events on the renderer main thread, plus the
 * navigationStart mark and thread_name meta events needed by parseFlameChart.
 */
function extractCompactTrace(traces: unknown): CompactTrace | undefined {
  try {
    const raw = resolveTraceEvents(traces);
    if (!Array.isArray(raw) || raw.length === 0) return undefined;

    type E = { ph: string; pid: number; name: string; dur?: number };

    // Find renderer PID via RunTask frequency
    const pidMap = new Map<number, number>();
    for (const e of raw as E[]) {
      if (e.ph === 'X' && (e.name === 'RunTask' || e.name === 'Task') && e.dur && e.dur > 0) {
        pidMap.set(e.pid, (pidMap.get(e.pid) ?? 0) + 1);
      }
    }
    if (pidMap.size === 0) return undefined;
    const top = [...pidMap.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!top) return undefined;
    const pid = top[0];

    // Keep only events relevant to parseFlameChart
    const filtered = (raw as E[]).filter(e =>
      e.pid === pid && (
        (e.ph === 'X' && e.dur && e.dur >= 100) ||  // complete events ≥ 0.1ms
        e.name === 'navigationStart' ||
        e.name === 'thread_name'
      ),
    );

    return { defaultPass: { traceEvents: filtered } };
  } catch {
    return undefined;
  }
}

async function run(): Promise<void> {
  const { url, categories } = workerData as WorkerInput;
  const browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });

  try {
    const port = Number(new URL(browser.wsEndpoint()).port);
    const result = await lighthouse(url, {
      port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: categories,
      screenEmulation: { disabled: true },
      throttlingMethod: 'provided',
    });

    if (!result) throw new Error('Lighthouse returned no result');

    // Extract a compact trace when running the performance categories
    let compactTrace: CompactTrace | undefined;
    let traceMaxMs: number | undefined;
    if (categories.includes('performance')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arts = (result as any)?.artifacts;
      // Lighthouse v12: artifacts.Trace (capital T, direct trace object)
      // Lighthouse v10/11: artifacts.traces (lowercase, nested by pass name)
      const traces = arts?.Trace ?? arts?.traces ?? arts?.defaultPass;
      if (traces) {
        compactTrace = extractCompactTrace(traces);
        traceMaxMs   = result.lhr.audits?.['interactive']?.numericValue ?? 15000;
      }
    }

    const msg: WorkerMessage = (compactTrace && traceMaxMs != null)
      ? { type: 'result', lhr: result.lhr, compactTrace, traceMaxMs }
      : { type: 'result', lhr: result.lhr };
    parentPort!.postMessage(msg);
  } finally {
    await browser.close().catch(() => void 0);
  }
}

run().catch((err) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  parentPort!.postMessage({ type: 'error', message } satisfies WorkerMessage);
});
