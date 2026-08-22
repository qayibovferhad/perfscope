import { workerData, parentPort } from 'worker_threads';
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import type { RunnerResult } from 'lighthouse';
// Type-only, erased at compile time, so the wire shape cannot drift from the parser's.
import type { CompactNetworkEvent, InitiatorData } from './dependency-parser.js';

// NOTE: this worker must stay self-contained (no VALUE imports from other src files;
// type-only imports are erased and safe) — the tsx loader inside worker threads cannot
// resolve cross-file .js→.ts specifiers. Keep in sync with CHROME_ARGS in lib/chrome.ts.
const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

interface WorkerInput {
  url: string;
  categories: string[];
  formFactor?: 'mobile' | 'desktop';
  /** 'provided' observes the load for real; 'simulate' skips that observation, which is
   *  only safe for categories that report no timings. The caller decides — see
   *  STATIC_CATEGORIES in lighthouse.service.ts. */
  throttlingMethod?: 'provided' | 'simulate';
  /** Crop a picture of each failing element out of the page. Costs the full-page
   *  screenshot Lighthouse otherwise skips, so only the static group is ever asked. */
  captureElements?: boolean;
}

// ─── Element screenshots ──────────────────────────────────────────────────────

/** Details rows cropped per audit. Three is what a person needs to recognise the pattern;
 *  the fourth failing image tells them nothing the third did not. Matches the first three
 *  of the five details `extractAuditDetails` keeps, so every shot has a row to sit on. */
const SHOTS_PER_AUDIT = 3;

/** Whole-run ceiling. A page can fail twenty audits with five nodes each; at ~20KB a crop
 *  that is a megabyte on a document that also carries a trace and a filmstrip. */
const SHOTS_PER_RUN = 24;

/** Beyond this a "crop" is a screenshot of the page with the element somewhere in it. A
 *  wide banner becomes its middle slice, which the selector beside it already names. */
const MAX_CROP = { width: 480, height: 320 };
const MIN_CROP = { width: 48, height: 32 };
/** Context around the element, so a button is a button and not a coloured rectangle. */
const CROP_PADDING = 12;

interface Rect { left: number; top: number; width: number; height: number }

/**
 * Crop each failing element out of Lighthouse's full-page screenshot.
 *
 * Lighthouse already knows where every failing node is — `lhr.fullPageScreenshot` holds one
 * capture of the whole document plus a rect per node id — and the analyzer showed the
 * reader a selector and left them to find it. This turns that selector into a picture.
 *
 * Cropping runs here, in the worker, using the Chrome that just did the audit: the image is
 * painted into a blank page at its natural size and screenshotted back with a clip, which
 * costs no native image dependency and no second process. Nothing about the audited page is
 * loaded again — the pixels all come from the capture Lighthouse already took.
 *
 * Returns `{}` on any failure. A missing thumbnail is a smaller loss than a failed audit.
 */
async function cropElementShots(
  browser: import('puppeteer').Browser,
  lhr: RunnerResult['lhr'],
): Promise<Record<string, string>> {
  const fps = (lhr as unknown as {
    fullPageScreenshot?: { screenshot?: { data?: string; width?: number; height?: number }; nodes?: Record<string, Rect> };
  }).fullPageScreenshot;

  const data = fps?.screenshot?.data;
  // Lighthouse reports these as CSS pixels and they come back fractional (728.7179…).
  // Puppeteer's viewport and clip both demand integers, and a fractional one throws —
  // which, before this rounding, meant every crop silently failed and the feature looked
  // like it had simply produced nothing.
  const width  = Math.floor(fps?.screenshot?.width  ?? 0);
  const height = Math.floor(fps?.screenshot?.height ?? 0);
  if (!data || width < 1 || height < 1 || !fps?.nodes) return {};

  // Which nodes are worth a picture: the ones attached to a *failing* audit, in the same
  // order and the same first-N slice the details themselves use.
  const wanted: string[] = [];
  for (const audit of Object.values(lhr.audits ?? {})) {
    const a = audit as { score?: number | null; details?: { items?: unknown[] } };
    if (a.score === null || (a.score ?? 1) >= 0.9) continue;
    let taken = 0;
    for (const raw of a.details?.items ?? []) {
      if (taken >= SHOTS_PER_AUDIT || wanted.length >= SHOTS_PER_RUN) break;
      const lhId = (raw as { node?: { lhId?: string } })?.node?.lhId;
      if (!lhId || wanted.includes(lhId)) continue;
      const rect = fps.nodes[lhId];
      // A zero-sized or off-canvas node has nothing to show; a full-page-sized rect is the
      // document, not an element.
      if (!rect || rect.width < 1 || rect.height < 1) continue;
      if (rect.top >= height || rect.left >= width) continue;
      wanted.push(lhId);
      taken++;
    }
    if (wanted.length >= SHOTS_PER_RUN) break;
  }
  if (wanted.length === 0) return {};

  const page = await browser.newPage();
  const shots: Record<string, string> = {};
  try {
    // Lighthouse captures at DPR 1, so a node rect is in the same pixel space as the
    // image — the viewport is set to match so the two cannot drift.
    await page.setViewport({ width, height: Math.min(height, 8000), deviceScaleFactor: 1 });
    await page.setContent(
      `<body style="margin:0"><img id="s" src="${data}" style="display:block;width:${width}px;height:${height}px"></body>`,
      { waitUntil: 'load' },
    );
    // `waitUntil: 'load'` already waits for the image, but a decode that has not finished
    // yields blank crops — this asserts the pixels are there. Passed as a string so the
    // browser-context code needs no DOM lib in the backend's tsconfig.
    await page.waitForFunction('document.getElementById("s")?.complete === true', { timeout: 10_000 })
      .catch(() => void 0);

    for (const lhId of wanted) {
      const rect = fps.nodes[lhId]!;
      const padded = {
        x: Math.max(0, Math.round(rect.left - CROP_PADDING)),
        y: Math.max(0, Math.round(rect.top - CROP_PADDING)),
        width:  Math.round(rect.width  + CROP_PADDING * 2),
        height: Math.round(rect.height + CROP_PADDING * 2),
      };
      const clip = {
        x: padded.x,
        y: padded.y,
        width:  Math.min(Math.max(padded.width,  MIN_CROP.width),  MAX_CROP.width,  width  - padded.x),
        height: Math.min(Math.max(padded.height, MIN_CROP.height), MAX_CROP.height, height - padded.y),
      };
      if (clip.width < 1 || clip.height < 1) continue;

      try {
        const shot = await page.screenshot({ type: 'jpeg', quality: 70, encoding: 'base64', clip, captureBeyondViewport: true });
        shots[lhId] = `data:image/jpeg;base64,${shot}`;
      } catch (err) {
        // One crop failing is not worth losing the rest — but it is worth saying, or a
        // silent zero looks like "this page had nothing to show".
        console.warn(`[Worker] Element crop failed for ${lhId}:`, (err as Error).message);
      }
    }
  } finally {
    await page.close().catch(() => void 0);
  }
  return shots;
}

// Compact trace sent back to the service so parseFlameChart can run there
// (avoids worker-thread module-resolution issues with tsx's .js→.ts remapping)
type CompactTrace = { defaultPass: { traceEvents: unknown[] } };

type WorkerMessage =
  | {
      type: 'result';
      lhr: RunnerResult['lhr'];
      compactTrace?: CompactTrace;
      traceMaxMs?: number;
      networkEvents?: CompactNetworkEvent[];
      /** Cropped pictures of failing elements, keyed by Lighthouse node id. */
      elementShots?: Record<string, string>;
    }
  | { type: 'error'; message: string }
  /** Sent right after launch so the parent can kill the browser if it has to terminate us. */
  | { type: 'browser'; pid: number | undefined }
  /** Sent once the browser is actually closed — the parent may terminate this thread now. */
  | { type: 'closed' };

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

    // Keep events relevant to parseFlameChart AND parseHeapMemory
    const filtered = (raw as E[]).filter(e =>
      e.pid === pid && (
        (e.ph === 'X' && e.dur && e.dur >= 100) ||  // complete events ≥ 0.1ms (flame chart)
        e.name === 'navigationStart' ||
        e.name === 'thread_name' ||
        e.name === 'UpdateCounters'                  // heap memory tracking (ph='I')
      ),
    );

    return { defaultPass: { traceEvents: filtered } };
  } catch {
    return undefined;
  }
}

/** Extract Network.requestWillBeSent events from Lighthouse artifacts (inside worker). */
function extractCompactNetworkEvents(artifacts: unknown): CompactNetworkEvent[] | undefined {
  try {
    if (!artifacts || typeof artifacts !== 'object') return undefined;
    const obj = artifacts as Record<string, unknown>;

    let log: unknown[] | undefined;
    if (Array.isArray(obj['DevtoolsLog'])) {
      log = obj['DevtoolsLog'] as unknown[];
    } else {
      const logs = obj['devtoolsLogs'] as Record<string, unknown> | undefined;
      if (logs && Array.isArray(logs['defaultPass'])) {
        log = logs['defaultPass'] as unknown[];
      }
    }
    if (!log || log.length === 0) return undefined;

    type CdpEntry = { method: string; params?: { request?: { url?: string }; initiator?: InitiatorData } };
    const events: CompactNetworkEvent[] = [];
    for (const entry of log as CdpEntry[]) {
      if (entry.method !== 'Network.requestWillBeSent') continue;
      const url = entry.params?.request?.url;
      const initiator = entry.params?.initiator;
      if (url && initiator) events.push({ url, initiator });
    }
    return events.length > 0 ? events : undefined;
  } catch {
    return undefined;
  }
}

async function run(): Promise<void> {
  const { url, categories, formFactor, throttlingMethod = 'provided', captureElements = false } = workerData as WorkerInput;
  const browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });
  // Hand the pid to the parent immediately: if this thread is ever terminated
  // (cancel, timeout) its `finally` never runs, and only the parent can then
  // stop the browser from outliving everything.
  parentPort!.postMessage({ type: 'browser', pid: browser.process()?.pid } satisfies WorkerMessage);

  try {
    const port = Number(new URL(browser.wsEndpoint()).port);
    const result = await lighthouse(url, {
      port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: categories,
      ...(formFactor === 'mobile'
        ? { formFactor: 'mobile' as const,
            screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false } }
        : { screenEmulation: { disabled: true } }),
      throttlingMethod,
      // The full-page screenshot is a second capture of the whole document. It used to be
      // dead weight — the filmstrip comes from the trace (`screenshot-thumbnails`, verified
      // unaffected) — and turning it off saved ~2-3s per run alongside skipAboutBlank.
      //
      // It is now what the element thumbnails are cropped out of, so the caller can ask for
      // it back. Only the *static* group ever does: that group reports no timings, so the
      // extra capture cannot distort a number, and in Fast mode it runs in parallel with the
      // timed group anyway.
      disableFullPageScreenshot: !captureElements,
      skipAboutBlank: true,
    });

    if (!result) throw new Error('Lighthouse returned no result');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arts = (result as any)?.artifacts;

    // Extract a compact trace when running the performance categories
    let compactTrace: CompactTrace | undefined;
    let traceMaxMs: number | undefined;
    if (categories.includes('performance')) {
      // Lighthouse v12: artifacts.Trace (capital T, direct trace object)
      // Lighthouse v10/11: artifacts.traces (lowercase, nested by pass name)
      const traces = arts?.Trace ?? arts?.traces ?? arts?.defaultPass;
      if (traces) {
        compactTrace = extractCompactTrace(traces);
        traceMaxMs   = result.lhr.audits?.['interactive']?.numericValue ?? 15000;
      }
    }

    // Extract compact devtools network events for dependency graph (all categories)
    const networkEvents = extractCompactNetworkEvents(arts);

    // Crop before the LHR is posted, because the crops come out of a field that is then
    // deleted: the whole-page capture is megabytes, nothing downstream reads it, and
    // structured-cloning it to the parent would cost more than every thumbnail together.
    let elementShots: Record<string, string> | undefined;
    if (captureElements) {
      elementShots = await cropElementShots(browser, result.lhr).catch((err: unknown) => {
        console.warn('[Worker] Element capture failed:', (err as Error).message);
        return {};
      });
    }
    delete (result.lhr as { fullPageScreenshot?: unknown }).fullPageScreenshot;

    // Lighthouse does not throw when the page fails to load — it returns an LHR whose
    // runtimeError is set and whose category scores are all null. Left alone, toScore()
    // turns those nulls into 0 and the failure gets stored as a legitimate 0-score audit.
    const runtimeError = (result.lhr as { runtimeError?: { code?: string; message?: string } }).runtimeError;
    if (runtimeError?.code && runtimeError.code !== 'NO_ERROR') {
      parentPort!.postMessage({
        type:    'error',
        message: runtimeError.message ?? `Lighthouse could not analyze the page (${runtimeError.code})`,
      } satisfies WorkerMessage);
      return;
    }

    const msg: WorkerMessage = {
      type: 'result',
      lhr: result.lhr,
      ...(compactTrace && traceMaxMs != null ? { compactTrace, traceMaxMs } : {}),
      ...(networkEvents ? { networkEvents } : {}),
      ...(elementShots && Object.keys(elementShots).length > 0 ? { elementShots } : {}),
    };
    parentPort!.postMessage(msg);
  } finally {
    await browser.close().catch(() => void 0);
    // Tells the parent the browser is gone and this thread is safe to terminate.
    parentPort!.postMessage({ type: 'closed' } satisfies WorkerMessage);
  }
}

run().catch((err) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  parentPort!.postMessage({ type: 'error', message } satisfies WorkerMessage);
});
