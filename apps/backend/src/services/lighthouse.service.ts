import { EventEmitter } from 'events';
import { CHROME_ARGS } from '../lib/chrome.js';
import { Worker } from 'worker_threads';
import puppeteer, { type Browser } from 'puppeteer';
import lighthouse, { type RunnerResult } from 'lighthouse';

// Dev (tsx): import.meta.url ends with .ts → use .ts worker
// Prod (compiled): ends with .js → use compiled .js worker
const workerExt = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
const WORKER_URL = new URL(`./lighthouse.worker${workerExt}`, import.meta.url);
import { v4 as uuidv4 } from 'uuid';
import { parseFlameChart } from './flame-chart-parser.js';
import { parseHeapMemory } from './heap-memory-parser.js';
import { parseInteractions } from './interaction-parser.js';
import type { CompactNetworkEvent } from './dependency-parser.js';
import { buildPartial, buildFullResult, toScore, detectAuthRedirect } from './lhr-transform.js';
import { AuditQueue, type AuditPriority } from './auditQueue.js';
import type { AuthSessionData } from './authAuditSession.js';
import { SessionExpiredError } from '../lib/errors.js';
import { trackChrome, killChrome } from '../lib/chromeReaper.js';
import { config } from '../config/index.js';
import type { AnalysisResult, AnalysisProgress, AnalysisCategory, AuditFormFactor, CategoryPartial, MeasurementQuality, FlameChartData, HeapMemoryData, InteractionData } from '@perfscope/shared';

/** What one worker thread hands back for a single Lighthouse pass. */
interface WorkerRunResult {
  lhr:              RunnerResult['lhr'];
  flameChartData?:  FlameChartData;
  heapMemoryData?:  HeapMemoryData;
  interactionData?: InteractionData;
  networkEvents?:   CompactNetworkEvent[];
}

/**
 * Pick the run that represents the page.
 *
 * The median is taken over whole runs rather than per metric so the reported
 * numbers stay internally consistent — the waterfall, filmstrip and trace all
 * belong to the same load as the score beside them. Averaging metrics would
 * produce a page that never actually existed.
 */
function pickMedianRun<T extends { lhr: WorkerRunResult['lhr'] }>(
  runs: T[],
): { run: T; measurement: MeasurementQuality } {
  const scored = runs
    .map(run => ({ run, score: toScore(run.lhr.categories['performance']?.score) }))
    .sort((a, b) => a.score - b.score);

  const median = scored[Math.floor((scored.length - 1) / 2)]!;
  const scores = runs.map(run => toScore(run.lhr.categories['performance']?.score));
  const spread = scored.length > 1 ? scored[scored.length - 1]!.score - scored[0]!.score : 0;

  return { run: median.run, measurement: { runs: runs.length, scores, median: median.score, spread } };
}

type ActiveAnalysis =
  | { type: 'browser'; browser: Browser; abortController: AbortController }
  | { type: 'workers'; workers: Worker[] };


const CATEGORIES: AnalysisCategory[] = ['performance', 'accessibility', 'best-practices', 'seo'];

/**
 * Categories whose score is a property of the markup, not of this particular load.
 *
 * Accessibility belongs here: it inspects the rendered DOM and scores the same however
 * the page was loaded. Verified against three sites — a local page, example.com and a
 * slow production site — where seo/best-practices/accessibility came back identical
 * whether measured load-accurately or not (82/100/90, 80/96/100, 83/57/67).
 *
 * That is why this group runs with `throttlingMethod: 'simulate'`: Lighthouse only
 * enforces its 5.25s quiet windows when it has to observe real timings, and this group
 * has no timings worth observing. The same three sites took 16.7s → 6.9s, 13.8s → 5.1s
 * and 56.2s → 14.5s. No reported number changes.
 */
const STATIC_CATEGORIES: AnalysisCategory[] = ['seo', 'best-practices', 'accessibility'];
/** Categories that measure the load itself and therefore vary run to run. */
const TIMED_CATEGORIES:  AnalysisCategory[] = ['performance'];

/** More than this and the wait stops being worth the extra precision. */
const MAX_RUNS = 5;

/**
 * The one progress scale, shared by all three audit paths.
 *
 * These used to be literals at seventeen call sites, and the two paths that interpolate
 * "run i of n" used different formulas (30 + 55·i/runs against 35 + 50·i/runs), so the
 * same stage of the same kind of audit reported different percentages depending on how it
 * was started. Everything the timed band does — runs, the REST ticker, the parallel
 * advance — now lives in [auditing, auditCeil]; processing sits above the ceiling so no
 * amount of in-band activity can overtake it.
 *
 * Unifying moved two numbers slightly: the streaming path's run interpolation now starts
 * at 35 (was 30), and the parallel path's cap is 85 (was 88).
 */
const PCT = {
  error:        0,
  queued:       2,
  launching:    10,
  /** Session transfer, or the static categories — everything before the timed band. */
  preparing:    20,
  browserReady: 25,
  auditing:     35,
  auditCeil:    85,
  processing:   90,
  complete:     100,
} as const;

/** Where run i of n sits inside the auditing band. */
function runProgress(i: number, runs: number): number {
  return PCT.auditing + Math.round(((PCT.auditCeil - PCT.auditing) * i) / runs);
}

/** A single Lighthouse pass that outlives this is wedged, not slow. */
const RUN_TIMEOUT_MS = 4 * 60_000;
/** Grace period for a finished worker to close its browser before we do it for it. */
const CLOSE_GRACE_MS = 15_000;

export interface AnalyzeOptions {
  // Explicit `| undefined` so callers can spread optional values under
  // exactOptionalPropertyTypes without pre-filtering them.
  formFactor?: AuditFormFactor | undefined;
  /**
   * How many times to measure the timed categories. The median run is reported,
   * so an odd number is the useful choice. 1 keeps the fast parallel path.
   */
  runs?:       number | undefined;
  /** Supply an id to correlate progress events with this specific audit. */
  analysisId?: string | undefined;
  priority?:   AuditPriority | undefined;
}

/** Global admission control — see AuditQueue for why this is a correctness feature. */
const auditQueue = new AuditQueue(config.maxConcurrentAudits);

/**
 * Everything the trace parsers can get out of one main-thread Lighthouse run.
 *
 * Lighthouse's own types do not describe `artifacts`, hence the single cast — kept here
 * so the two entry paths that need it (single-shot and injected-session) share one
 * instead of carrying an `any` escape each. The worker path does not use this: it ships a
 * compact trace across the thread boundary and parses on the other side.
 *
 * The artifact moved between versions — `Trace` in v12, `traces` in v10/v11 — and
 * `defaultPass` is the older container. That is a different question from
 * `lib/trace.ts`'s `resolveTraceEvents`, which unwraps whichever of those we land on.
 */
function extractTraceData(runnerResult: { lhr: { audits?: Record<string, { numericValue?: number } | undefined> } }) {
  const maxMs = runnerResult.lhr.audits?.['interactive']?.numericValue ?? 15000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artifacts = (runnerResult as any)?.artifacts;
  const traces = artifacts?.Trace ?? artifacts?.traces ?? artifacts?.defaultPass;

  return {
    artifacts,
    flameChartData:  traces ? (parseFlameChart(traces, maxMs) ?? undefined) : undefined,
    heapMemoryData:  traces ? (parseHeapMemory(traces)        ?? undefined) : undefined,
    interactionData: traces ? (parseInteractions(traces)      ?? undefined) : undefined,
  };
}


export class LighthouseService extends EventEmitter {
  private readonly activeAnalyses = new Map<string, ActiveAnalysis>();

  // Serialises concurrent main-thread Lighthouse runs so they never share
  // performance marks (workers are exempt — each thread has its own context).
  private _mainThreadQueue: Promise<unknown> = Promise.resolve();
  private queueMainThreadRun<T>(fn: () => Promise<T>): Promise<T> {
    const next = this._mainThreadQueue.then(fn, fn) as Promise<T>;
    this._mainThreadQueue = next.then(() => {}, () => {});
    return next;
  }

  // ─── Single-run (REST path) ───────────────────────────────────────────────

  async analyze(url: string, opts: AnalyzeOptions = {}): Promise<AnalysisResult> {
    const analysisId = opts.analysisId ?? uuidv4();
    return auditQueue.run(() => this.singleShotAudit(analysisId, url), {
      priority: opts.priority ?? 'interactive',
      onQueue:  this.queueReporter(analysisId),
    });
  }

  private async singleShotAudit(analysisId: string, url: string): Promise<AnalysisResult> {
    let browser: Browser | null = null;
    try {
      browser = await this.launchBrowser(analysisId);
      const runnerResult = await this.runLighthouse(url, analysisId, browser, CATEGORIES);
      const { artifacts, flameChartData, heapMemoryData, interactionData } = extractTraceData(runnerResult);
      return buildFullResult(analysisId, url, [runnerResult.lhr], flameChartData, heapMemoryData, interactionData, undefined, artifacts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      this.emitProgress(analysisId, 'error', PCT.error, `Error: ${message}`);
      throw err;
    } finally {
      if (browser) await browser.close().catch(() => void 0);
      this.activeAnalyses.delete(analysisId);
    }
  }

  // ─── Streaming (WebSocket path) ───────────────────────────────────────────
  // Two Lighthouse runs in separate Worker threads → truly parallel.
  // Each worker manages its own Chrome instance (no performance.mark conflict).
  // Whichever worker finishes first emits its partials immediately.

  async analyzeStreaming(
    url: string,
    onPartial: (partial: CategoryPartial) => void,
    opts: AnalyzeOptions = {},
  ): Promise<AnalysisResult> {
    const analysisId = opts.analysisId ?? uuidv4();
    return auditQueue.run(
      () => this.streamingAudit(analysisId, url, onPartial, opts),
      { priority: opts.priority ?? 'interactive', onQueue: this.queueReporter(analysisId) },
    );
  }

  /** Progress callback that tells the client why its audit has not started yet. */
  private queueReporter(analysisId: string) {
    return (position: number) =>
      this.emitProgress(
        analysisId, 'launching', PCT.queued,
        position === 1 ? 'Queued — next in line…' : `Queued — ${position - 1} audit(s) ahead…`,
      );
  }

  private async streamingAudit(
    analysisId: string,
    url: string,
    onPartial: (partial: CategoryPartial) => void,
    opts: AnalyzeOptions,
  ): Promise<AnalysisResult> {
    const { formFactor } = opts;
    const runs = Math.max(1, Math.min(Math.floor(opts.runs ?? 1), MAX_RUNS));
    const workers: Worker[] = [];

    // Register workers immediately so cancelAnalysis can terminate them at any point
    this.activeAnalyses.set(analysisId, { type: 'workers', workers });

    try {
      this.emitProgress(analysisId, 'launching', PCT.launching, 'Launching Chrome instances...');

      const emitFor = (cats: AnalysisCategory[], lhr: RunnerResult['lhr']) => {
        for (const cat of cats) onPartial(buildPartial(analysisId, cat, lhr));
      };

      let staticRes: WorkerRunResult;
      let timedRuns: WorkerRunResult[];

      if (runs === 1) {
        // Fast path: both workers in parallel, whichever finishes first streams.
        this.emitProgress(analysisId, 'auditing', PCT.auditing, 'Running parallel audits...');
        let progress: number = PCT.auditing;
        const advance = (by: number, msg: string) => {
          progress = Math.min(progress + by, PCT.auditCeil);
          this.emitProgress(analysisId, 'auditing', progress, msg);
        };

        const staticRun = this.runLighthouseInWorker(url, STATIC_CATEGORIES, workers, formFactor, 'simulate')
          .then((res): WorkerRunResult => {
            emitFor(STATIC_CATEGORIES, res.lhr);
            advance(27, 'SEO, Best Practices & Accessibility complete');
            return res;
          });

        const timedRun = this.runLighthouseInWorker(url, TIMED_CATEGORIES, workers, formFactor)
          .then((res): WorkerRunResult => {
            emitFor(TIMED_CATEGORIES, res.lhr);
            advance(27, 'Performance complete');
            return res;
          });

        [staticRes, timedRuns] = await Promise.all([staticRun, timedRun.then(r => [r])]);
      } else {
        // Precision path: nothing else may share the CPU while a timed run is in
        // flight, otherwise the extra iterations measure contention instead of the
        // page. Static categories go first (they cannot be perturbed), then each
        // timed iteration runs alone.
        this.emitProgress(analysisId, 'auditing', PCT.preparing, 'Auditing SEO, Best Practices & Accessibility...');
        staticRes = await this.runLighthouseInWorker(url, STATIC_CATEGORIES, workers, formFactor, 'simulate');
        emitFor(STATIC_CATEGORIES, staticRes.lhr);

        timedRuns = [];
        for (let i = 0; i < runs; i++) {
          this.emitProgress(
            analysisId, 'auditing',
            runProgress(i, runs),
            `Measuring performance — run ${i + 1} of ${runs}...`,
          );
          const res = await this.runLighthouseInWorker(url, TIMED_CATEGORIES, workers, formFactor);
          timedRuns.push(res);
          // Stream the first iteration so the user sees real numbers early; later
          // iterations refine them and the median is emitted below.
          if (i === 0) emitFor(TIMED_CATEGORIES, res.lhr);
        }
      }

      this.emitProgress(analysisId, 'processing', PCT.processing, 'Finalizing results...');

      const { run: medianRun, measurement } = pickMedianRun(timedRuns);
      if (runs > 1) emitFor(TIMED_CATEGORIES, medianRun.lhr);

      const flameData       = medianRun.flameChartData  ?? staticRes.flameChartData;
      const heapData        = medianRun.heapMemoryData  ?? staticRes.heapMemoryData;
      const interactionData = medianRun.interactionData ?? staticRes.interactionData;
      const networkEvents   = medianRun.networkEvents   ?? staticRes.networkEvents;

      const full = buildFullResult(
        analysisId, url, [staticRes.lhr, medianRun.lhr],
        flameData, heapData, interactionData, networkEvents,
      );
      full.formFactor  = formFactor ?? 'desktop';
      full.measurement = measurement;

      this.emitProgress(analysisId, 'complete', PCT.complete, 'Analysis completed successfully!');
      return full;
    } finally {
      this.activeAnalyses.delete(analysisId);
    }
  }

  // ─── Authenticated audit (session transfer) ──────────────────────────────
  // Accepts pre-extracted cookies + localStorage from the visible login browser.
  // Launches a fresh headless Chrome, injects the session, runs one or more
  // Lighthouse passes (all categories), then closes the headless browser.

  async analyzeWithInjectedSession(
    url: string,
    sessionData: AuthSessionData,
    onPartial: (partial: CategoryPartial) => void,
    opts: AnalyzeOptions = {},
  ): Promise<AnalysisResult> {
    const analysisId = opts.analysisId ?? uuidv4();
    const runs = Math.max(1, Math.min(Math.floor(opts.runs ?? 1), MAX_RUNS));
    return auditQueue.run(
      () => this.injectedSessionAudit(analysisId, url, sessionData, onPartial, opts.formFactor, runs),
      { priority: opts.priority ?? 'interactive', onQueue: this.queueReporter(analysisId) },
    );
  }

  private async injectedSessionAudit(
    analysisId: string,
    url: string,
    sessionData: AuthSessionData,
    onPartial: (partial: CategoryPartial) => void,
    formFactor?: AuditFormFactor,
    runs = 1,
  ): Promise<AnalysisResult> {
    let browser: Browser | null = null;

    try {
      this.emitProgress(analysisId, 'launching', PCT.launching, 'Launching audit browser...');

      browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });
      trackChrome(browser.process()?.pid);
      this.activeAnalyses.set(analysisId, { type: 'browser', browser, abortController: new AbortController() });

      const { cookies, localStorage: ls } = sessionData;
      const hasCookies = cookies.length > 0;
      const hasLs      = Object.keys(ls).length > 0;

      this.emitProgress(analysisId, 'navigating', PCT.preparing, 'Transferring session...');

      // ── Step 1: Set cookies browser-wide via a setup page ────────────────
      // Navigate to the target origin so cookies are scoped correctly and
      // localStorage can be written to the right origin.
      if (hasCookies || hasLs) {
        const setupPage = await browser.newPage();
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (hasCookies) await setupPage.setCookie(...(cookies as any[])).catch(() => {});
          if (hasLs) {
            await setupPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => {});
            await setupPage.evaluate((data: Record<string, string>) => {
              for (const [k, v] of Object.entries(data)) {
                try { localStorage.setItem(k, v); } catch { /* quota — skip */ }
              }
            }, ls).catch(() => {});
          }
        } finally {
          await setupPage.close().catch(() => {});
        }
      }

      // ── Step 2: Intercept Lighthouse's page via CDP before it navigates ──
      // Uses createCDPSession (faster than target.page()) so evaluateOnNewDocument
      // is registered before Lighthouse calls page.goto().
      if (hasLs) {
        const lsScript = `(function(){const d=${JSON.stringify(ls)};for(const k of Object.keys(d)){try{localStorage.setItem(k,d[k])}catch(e){}}})()`;
        browser.on('targetcreated', async (target) => {
          if (target.type() !== 'page') return;
          try {
            const session = await target.createCDPSession();
            await session.send('Page.addScriptToEvaluateOnNewDocument', { source: lsScript });
          } catch { /* page may already be closed */ }
        });
      }

      this.emitProgress(analysisId, 'auditing', PCT.auditing, 'Running Lighthouse audit...');

      let fakeProg: number = PCT.auditing;
      const ticker = setInterval(() => {
        fakeProg = Math.min(fakeProg + 3, PCT.auditCeil);
        this.emitProgress(analysisId, 'auditing', fakeProg, 'Running Lighthouse audit...');
      }, 3000);

      // A login-walled page gets the same treatment as any other when the caller asks for
      // it: the scheduled runs that feed budgets and regressions cannot be a single noisy
      // sample just because the page needs a cookie. Sequential and in the same browser —
      // the session is already loaded, and parallel loads would compete for the CPU they
      // are supposed to be measuring.
      const passes: Array<Awaited<ReturnType<typeof this.runLighthouse>>> = [];
      try {
        for (let i = 0; i < runs; i++) {
          if (runs > 1) {
            this.emitProgress(
              analysisId, 'auditing',
              runProgress(i, runs),
              `Running Lighthouse audit — run ${i + 1} of ${runs}...`,
            );
          }
          const pass = await this.runLighthouse(url, analysisId, browser, CATEGORIES, true, formFactor);
          passes.push(pass);

          // Stop after the first pass if the session is dead: the remaining runs would
          // measure the login page, and the caller is about to throw either way.
          const finalUrl = pass.lhr.finalDisplayedUrl ?? (pass.lhr as unknown as Record<string, string>)['finalUrl'];
          if (detectAuthRedirect(pass.lhr.requestedUrl, finalUrl)) break;
        }
      } finally {
        clearInterval(ticker);
      }

      const { run: runnerResult, measurement } = pickMedianRun(passes);

      this.emitProgress(analysisId, 'processing', PCT.processing, 'Finalizing results...');

      for (const cat of CATEGORIES) {
        onPartial(buildPartial(analysisId, cat, runnerResult.lhr));
      }

      const { artifacts, flameChartData, heapMemoryData, interactionData } = extractTraceData(runnerResult);

      const result = buildFullResult(
        analysisId, url, [runnerResult.lhr],
        flameChartData, heapMemoryData, interactionData,
        undefined, artifacts,
      );
      result.formFactor = formFactor ?? 'desktop';
      if (passes.length > 1) result.measurement = measurement;

      // A session was injected and Lighthouse still ended up on a login screen:
      // the cookies are stale. Reporting this as a 0-score audit would poison the
      // site's history, so fail loudly and let the caller drop the session.
      if (result.authRedirectDetected) {
        throw new SessionExpiredError(result.authRedirectDetected.finalUrl);
      }

      this.emitProgress(analysisId, 'complete', PCT.complete, 'Analysis completed successfully!');
      return result;
    } finally {
      if (browser) await browser.close().catch(() => {});
      this.activeAnalyses.delete(analysisId);
    }
  }

  private runLighthouseInWorker(
    url: string,
    categories: string[],
    workerRegistry: Worker[],
    formFactor?: AuditFormFactor,
    /** Only the timed group needs Lighthouse to observe the load for real — see
     *  STATIC_CATEGORIES for why the other group does not, and what it buys. */
    throttlingMethod: 'provided' | 'simulate' = 'provided',
  ): Promise<WorkerRunResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_URL, {
        workerData: { url, categories, formFactor, throttlingMethod },
        execArgv: process.execArgv, // inherit tsx loader in dev
      });

      // Register immediately so cancelAnalysis can terminate this worker
      workerRegistry.push(worker);

      let chromePid: number | undefined;
      let untrackChrome: () => void = () => {};
      let settled = false;

      /**
       * Wind the worker down. A worker thread that is terminated never runs its
       * `finally`, so the browser is killed explicitly unless the thread already
       * told us it closed it.
       */
      const shutdown = (browserClosed: boolean) => {
        clearTimeout(runTimer);
        clearTimeout(closeTimer);
        if (!browserClosed) killChrome(chromePid);
        untrackChrome();
        worker.terminate().catch(() => {});
        const i = workerRegistry.indexOf(worker);
        if (i !== -1) workerRegistry.splice(i, 1);
      };

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        shutdown(false);
        reject(err);
      };

      const runTimer = setTimeout(
        () => fail(new Error(`Lighthouse run exceeded ${RUN_TIMEOUT_MS / 60_000} minutes and was aborted`)),
        RUN_TIMEOUT_MS,
      );
      // Armed once a result is in: the browser should close within the grace
      // period, otherwise we stop waiting and kill it ourselves.
      let closeTimer: NodeJS.Timeout | undefined;

      worker.on('message', (msg: {
        type: string; pid?: number; lhr?: RunnerResult['lhr']; compactTrace?: unknown;
        traceMaxMs?: number; networkEvents?: CompactNetworkEvent[]; message?: string;
      }) => {
        if (msg.type === 'browser') {
          chromePid     = msg.pid;
          untrackChrome = trackChrome(msg.pid);
          return;
        }

        if (msg.type === 'closed') {
          // Clean finish: the browser is gone, so only the thread is left to reap.
          if (settled) shutdown(true);
          return;
        }

        if (msg.type === 'result' && msg.lhr) {
          if (settled) return;
          settled = true;
          const r: WorkerRunResult = { lhr: msg.lhr };
          if (msg.compactTrace && msg.traceMaxMs != null) {
            const fc = parseFlameChart(msg.compactTrace, msg.traceMaxMs);
            if (fc) r.flameChartData = fc;
            const hm = parseHeapMemory(msg.compactTrace);
            if (hm) r.heapMemoryData = hm;
            const id = parseInteractions(msg.compactTrace);
            if (id) r.interactionData = id;
          }
          if (msg.networkEvents) r.networkEvents = msg.networkEvents;
          clearTimeout(runTimer);
          closeTimer = setTimeout(() => shutdown(false), CLOSE_GRACE_MS);
          // Resolve now; the browser teardown above continues in the background.
          resolve(r);
          return;
        }

        fail(new Error(msg.message ?? 'Worker returned no result'));
      });

      worker.once('error', (err) => fail(err instanceof Error ? err : new Error(String(err))));
      worker.once('exit', (code) => {
        // A worker that dies without a result took its browser's fate with it.
        if (!settled && code !== 0) fail(new Error(`Worker exited with code ${code}`));
        killChrome(chromePid);
        untrackChrome();
      });
    });
  }

  cancelAnalysis(analysisId: string): boolean {
    const analysis = this.activeAnalyses.get(analysisId);
    if (!analysis) return false;

    if (analysis.type === 'browser') {
      analysis.abortController.abort();
      analysis.browser.close().catch(() => void 0);
    } else {
      // terminate() kills the thread; each worker closes its own Chrome in its finally block
      for (const worker of analysis.workers) {
        worker.terminate().catch(() => void 0);
      }
    }

    this.activeAnalyses.delete(analysisId);
    return true;
  }

  // ─── Private: Browser ────────────────────────────────────────────────────

  private async launchBrowser(analysisId: string): Promise<Browser> {
    this.emitProgress(analysisId, 'launching', PCT.launching, 'Launching Chrome browser...');
    const browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });
    trackChrome(browser.process()?.pid);
    this.activeAnalyses.set(analysisId, { type: 'browser', browser, abortController: new AbortController() });
    this.emitProgress(analysisId, 'navigating', PCT.browserReady, 'Browser ready...');
    return browser;
  }

  private async runLighthouse(
    url: string,
    analysisId: string,
    browser: Browser,
    categories: AnalysisCategory[],
    disableStorageReset = false,
    formFactor?: AuditFormFactor,
  ): Promise<RunnerResult> {
    return this.queueMainThreadRun(async () => {
      // Clear any stale lh: marks left by a previous run that may have crashed
      // mid-flight, which would cause "performance mark has not been set" errors.
      try {
        for (const e of performance.getEntriesByType('mark')) {
          if (e.name.startsWith('lh:')) performance.clearMarks(e.name);
        }
      } catch { /* non-critical */ }

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
        throttlingMethod: 'provided',
        // Nothing downstream reads the full-page screenshot; the filmstrip comes from the
        // trace. `skipAboutBlank` is deliberately NOT set here: the injected-session path
        // hooks page creation over CDP to restore localStorage, and that sequence is not
        // worth a second off a run that already carries a login.
        disableFullPageScreenshot: true,
        ...(disableStorageReset ? { disableStorageReset: true } : {}),
      });

      if (!result) throw new Error('Lighthouse returned no result');

      // A page that fails to load does not throw — Lighthouse reports it inside the LHR
      // with every category score null, which toScore() would flatten to 0 and store as
      // a real audit. Surface it as an error instead. Mirrors the check in the worker.
      const runtimeError = (result.lhr as { runtimeError?: { code?: string; message?: string } }).runtimeError;
      if (runtimeError?.code && runtimeError.code !== 'NO_ERROR') {
        throw new Error(runtimeError.message ?? `Lighthouse could not analyze the page (${runtimeError.code})`);
      }

      return result;
    });
  }

  private emitProgress(
    analysisId: string,
    stage: AnalysisProgress['stage'],
    progress: number,
    message: string,
  ): void {
    this.emit('progress', { analysisId, stage, progress, message } satisfies AnalysisProgress);
  }
}

export const lighthouseService = new LighthouseService();
