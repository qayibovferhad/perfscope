import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import puppeteer, { type Browser } from 'puppeteer';
import lighthouse, { type RunnerResult } from 'lighthouse';

// Dev (tsx): import.meta.url ends with .ts → use .ts worker
// Prod (compiled): ends with .js → use compiled .js worker
const workerExt = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
const WORKER_URL = new URL(`./lighthouse.worker${workerExt}`, import.meta.url);
import { v4 as uuidv4 } from 'uuid';
import { parseResources } from './resource-parser.js';
import { parseFlameChart } from './flame-chart-parser.js';
import { parseHeapMemory } from './heap-memory-parser.js';
import { parseInteractions } from './interaction-parser.js';
import { parseDependenciesFromArtifacts, parseDependencies, type CompactNetworkEvent } from './dependency-parser.js';
import type {
  AnalysisResult,
  AnalysisProgress,
  AuditItem,
  AuditImpact,
  AnalysisCategory,
  CategoryPartial,
  TimelineData,
  TimelineFrame,
  FlameChartData,
  HeapMemoryData,
  InteractionData,
  CLSData,
  CLSShiftElement,
} from '../types/index.js';

type ActiveAnalysis =
  | { type: 'browser'; browser: Browser; abortController: AbortController }
  | { type: 'workers'; workers: Worker[] };

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

const CATEGORIES: AnalysisCategory[] = ['performance', 'accessibility', 'best-practices', 'seo'];

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

  async analyze(url: string): Promise<AnalysisResult> {
    const analysisId = uuidv4();
    let browser: Browser | null = null;
    try {
      browser = await this.launchBrowser(analysisId);
      const runnerResult = await this.runLighthouse(url, analysisId, browser, CATEGORIES);
      const maxMs    = runnerResult.lhr.audits?.['interactive']?.numericValue ?? 15000;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyResult = runnerResult as any;
      const traces = anyResult?.artifacts?.Trace    // Lighthouse v12
        ?? anyResult?.artifacts?.traces             // Lighthouse v10/v11
        ?? anyResult?.artifacts?.defaultPass;
      const flameChartData  = traces ? (parseFlameChart(traces, maxMs)    ?? undefined) : undefined;
      const heapMemoryData  = traces ? (parseHeapMemory(traces)           ?? undefined) : undefined;
      const interactionData = traces ? (parseInteractions(traces)         ?? undefined) : undefined;
      return this.buildFullResult(analysisId, url, [runnerResult.lhr], flameChartData, heapMemoryData, interactionData, undefined, anyResult?.artifacts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      this.emitProgress(analysisId, 'error', 0, `Error: ${message}`);
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
  ): Promise<AnalysisResult> {
    const analysisId = uuidv4();
    const workers: Worker[] = [];

    // Register workers immediately so cancelAnalysis can terminate them at any point
    this.activeAnalyses.set(analysisId, { type: 'workers', workers });

    this.emitProgress(analysisId, 'launching', 10, 'Launching Chrome instances...');
    this.emitProgress(analysisId, 'auditing',  35, 'Running parallel audits...');

    // Monotonically increasing progress shared across both worker callbacks.
    // Node.js is single-threaded so .then() callbacks are sequential — no mutex needed.
    let progress = 35;
    const advance = (by: number, stage: AnalysisProgress['stage'], msg: string) => {
      progress = Math.min(progress + by, 88); // cap before processing stage
      this.emitProgress(analysisId, stage, progress, msg);
    };

    const run1 = this.runLighthouseInWorker(url, ['seo', 'best-practices'], workers).then((res): typeof res => {
      for (const cat of ['seo', 'best-practices'] as AnalysisCategory[]) {
        onPartial(this.buildPartial(analysisId, cat, res.lhr));
      }
      advance(27, 'auditing', 'SEO & Best Practices complete');
      return res;
    });

    const run2 = this.runLighthouseInWorker(url, ['performance', 'accessibility'], workers).then((res): typeof res => {
      for (const cat of ['performance', 'accessibility'] as AnalysisCategory[]) {
        onPartial(this.buildPartial(analysisId, cat, res.lhr));
      }
      advance(27, 'auditing', 'Performance & Accessibility complete');
      return res;
    });

    const [res1, res2] = await Promise.all([run1, run2]);

    this.activeAnalyses.delete(analysisId);
    this.emitProgress(analysisId, 'processing', 90, 'Finalizing results...');
    // performance worker is run2; flame chart, heap, and interaction data come from there
    const flameData       = res2.flameChartData  ?? res1.flameChartData;
    const heapData        = res2.heapMemoryData  ?? res1.heapMemoryData;
    const interactionData = res2.interactionData ?? res1.interactionData;
    // Use network events from whichever worker captured them (prefer run2 for performance)
    const networkEvents = res2.networkEvents ?? res1.networkEvents;
    const full = this.buildFullResult(analysisId, url, [res1.lhr, res2.lhr], flameData, heapData, interactionData, networkEvents);
    this.emitProgress(analysisId, 'complete', 100, 'Analysis completed successfully!');
    return full;
  }

  // ─── Authenticated audit (session transfer) ──────────────────────────────
  // Accepts pre-extracted cookies + localStorage from the visible login browser.
  // Launches a fresh headless Chrome, injects the session, runs a single
  // Lighthouse pass (all categories), then closes the headless browser.

  async analyzeWithInjectedSession(
    url: string,
    sessionData: {
      cookies:      Array<{ name: string; value: string; domain: string | undefined; path: string | undefined; expires: number | undefined; httpOnly: boolean | undefined; secure: boolean | undefined; sameSite: string | undefined }>;
      localStorage: Record<string, string>;
    },
    onPartial: (partial: CategoryPartial) => void,
  ): Promise<AnalysisResult> {
    const analysisId = uuidv4();
    let browser: Browser | null = null;

    try {
      this.emitProgress(analysisId, 'launching', 10, 'Launching audit browser...');

      browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });
      this.activeAnalyses.set(analysisId, { type: 'browser', browser, abortController: new AbortController() });

      const { cookies, localStorage: ls } = sessionData;
      const hasCookies = cookies.length > 0;
      const hasLs      = Object.keys(ls).length > 0;

      this.emitProgress(analysisId, 'navigating', 20, 'Transferring session...');

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

      this.emitProgress(analysisId, 'auditing', 35, 'Running Lighthouse audit...');

      let fakeProg = 35;
      const ticker = setInterval(() => {
        fakeProg = Math.min(fakeProg + 3, 85);
        this.emitProgress(analysisId, 'auditing', fakeProg, 'Running Lighthouse audit...');
      }, 3000);

      let runnerResult: Awaited<ReturnType<typeof this.runLighthouse>>;
      try {
        runnerResult = await this.runLighthouse(url, analysisId, browser, CATEGORIES, true);
      } finally {
        clearInterval(ticker);
      }

      this.emitProgress(analysisId, 'processing', 90, 'Finalizing results...');

      for (const cat of CATEGORIES) {
        onPartial(this.buildPartial(analysisId, cat, runnerResult.lhr));
      }

      const maxMs    = runnerResult.lhr.audits?.['interactive']?.numericValue ?? 15000;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyResult = runnerResult as any;
      const traces =
        anyResult?.artifacts?.Trace    ??
        anyResult?.artifacts?.traces   ??
        anyResult?.artifacts?.defaultPass;

      const flameChartData  = traces ? (parseFlameChart(traces, maxMs) ?? undefined) : undefined;
      const heapMemoryData  = traces ? (parseHeapMemory(traces)        ?? undefined) : undefined;
      const interactionData = traces ? (parseInteractions(traces)      ?? undefined) : undefined;

      const result = this.buildFullResult(
        analysisId, url, [runnerResult.lhr],
        flameChartData, heapMemoryData, interactionData,
        undefined, anyResult?.artifacts,
      );

      this.emitProgress(analysisId, 'complete', 100, 'Analysis completed successfully!');
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
  ): Promise<{ lhr: RunnerResult['lhr']; flameChartData?: FlameChartData; heapMemoryData?: HeapMemoryData; interactionData?: InteractionData; networkEvents?: CompactNetworkEvent[] }> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_URL, {
        workerData: { url, categories },
        execArgv: process.execArgv, // inherit tsx loader in dev
      });

      // Register immediately so cancelAnalysis can terminate this worker
      workerRegistry.push(worker);

      worker.once('message', (msg: { type: string; lhr?: RunnerResult['lhr']; compactTrace?: unknown; traceMaxMs?: number; networkEvents?: CompactNetworkEvent[]; message?: string }) => {
        if (msg.type === 'result' && msg.lhr) {
          const r: { lhr: RunnerResult['lhr']; flameChartData?: FlameChartData; heapMemoryData?: HeapMemoryData; interactionData?: InteractionData; networkEvents?: CompactNetworkEvent[] } = { lhr: msg.lhr };
          if (msg.compactTrace && msg.traceMaxMs != null) {
            const fc = parseFlameChart(msg.compactTrace, msg.traceMaxMs);
            if (fc) r.flameChartData = fc;
            const hm = parseHeapMemory(msg.compactTrace);
            if (hm) r.heapMemoryData = hm;
            const id = parseInteractions(msg.compactTrace);
            if (id) r.interactionData = id;
          }
          if (msg.networkEvents) r.networkEvents = msg.networkEvents;
          resolve(r);
        } else {
          reject(new Error(msg.message ?? 'Worker returned no result'));
        }
      });
      worker.once('error', reject);
      worker.once('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
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
    this.emitProgress(analysisId, 'launching', 10, 'Launching Chrome browser...');
    const browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });
    this.activeAnalyses.set(analysisId, { type: 'browser', browser, abortController: new AbortController() });
    this.emitProgress(analysisId, 'navigating', 25, 'Browser ready...');
    return browser;
  }

  private async runLighthouse(
    url: string,
    analysisId: string,
    browser: Browser,
    categories: AnalysisCategory[],
    disableStorageReset = false,
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
        screenEmulation: { disabled: true },
        throttlingMethod: 'provided',
        ...(disableStorageReset ? { disableStorageReset: true } : {}),
      });

      if (!result) throw new Error('Lighthouse returned no result');
      return result;
    });
  }

  // ─── Private: Transform ──────────────────────────────────────────────────

  private buildPartial(
    analysisId: string,
    category: AnalysisCategory,
    lhr: RunnerResult['lhr'],
  ): CategoryPartial {
    const categoryKey = category === 'best-practices' ? 'best-practices' : category;
    const score = this.toScore(lhr.categories[categoryKey]?.score);
    const audits = this.extractFailingAudits(lhr.audits);

    const partial: CategoryPartial = { analysisId, category, score, audits };

    if (category === 'performance') {
      partial.metrics = {
        fcp: lhr.audits['first-contentful-paint']?.numericValue ?? 0,
        lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? 0,
        tbt: lhr.audits['total-blocking-time']?.numericValue ?? 0,
        cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? 0,
        si:  lhr.audits['speed-index']?.numericValue ?? 0,
        tti: lhr.audits['interactive']?.numericValue ?? 0,
      };
    }

    return partial;
  }

  private buildFullResult(
    id: string,
    url: string,
    lhrs: RunnerResult['lhr'][],
    flameChartData?: FlameChartData,
    heapMemoryData?: HeapMemoryData,
    interactionData?: InteractionData,
    networkEvents?: CompactNetworkEvent[],
    artifacts?: unknown,
  ): AnalysisResult {
    // Merge all category LHRs into one result
    const scores = { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };
    const metrics = { fcp: 0, lcp: 0, tbt: 0, cls: 0, si: 0, tti: 0 };
    const allAudits: AuditItem[] = [];
    let performanceLhr: RunnerResult['lhr'] | null = null;

    for (const lhr of lhrs) {
      scores.performance   = Math.max(scores.performance,   this.toScore(lhr.categories['performance']?.score));
      scores.accessibility = Math.max(scores.accessibility, this.toScore(lhr.categories['accessibility']?.score));
      scores.bestPractices = Math.max(scores.bestPractices, this.toScore(lhr.categories['best-practices']?.score));
      scores.seo           = Math.max(scores.seo,           this.toScore(lhr.categories['seo']?.score));

      if (lhr.categories['performance']) {
        metrics.fcp = lhr.audits['first-contentful-paint']?.numericValue ?? 0;
        metrics.lcp = lhr.audits['largest-contentful-paint']?.numericValue ?? 0;
        metrics.tbt = lhr.audits['total-blocking-time']?.numericValue ?? 0;
        metrics.cls = lhr.audits['cumulative-layout-shift']?.numericValue ?? 0;
        metrics.si  = lhr.audits['speed-index']?.numericValue ?? 0;
        metrics.tti = lhr.audits['interactive']?.numericValue ?? 0;
        performanceLhr = lhr;
      }

      allAudits.push(...this.extractFailingAudits(lhr.audits));
    }

    // Deduplicate audits by id
    const seen = new Set<string>();
    const uniqueAudits = allAudits.filter(({ id: auditId }) =>
      seen.has(auditId) ? false : (seen.add(auditId), true),
    );

    // Parse resources and timeline from the performance LHR
    const result: AnalysisResult = { id, url, timestamp: new Date().toISOString(), scores, metrics, audits: uniqueAudits };
    if (performanceLhr) {
      result.resources = parseResources(performanceLhr, url);
      const timeline = this.parseTimeline(performanceLhr);
      if (timeline) result.timelineData = timeline;

      const clsData = this.parseCLSData(performanceLhr);
      if (clsData) result.clsData = clsData;

      // Build dependency graph — prefer worker-extracted events, fall back to raw artifacts
      const requests = result.resources?.requests ?? [];
      if (networkEvents && networkEvents.length > 0) {
        const graph = parseDependencies(networkEvents, requests);
        if (graph) result.dependencyGraph = graph;
      } else if (artifacts) {
        const graph = parseDependenciesFromArtifacts(artifacts, requests);
        if (graph) result.dependencyGraph = graph;
      }
    }
    if (flameChartData)  result.flameChartData  = flameChartData;
    if (heapMemoryData)  result.heapMemoryData  = heapMemoryData;
    if (interactionData) result.interactionData = interactionData;
    return result;
  }

  private extractFailingAudits(
    audits: Record<string, { score?: number | null; title?: string; description?: string; displayValue?: string; details?: unknown }>,
  ): AuditItem[] {
    return Object.entries(audits)
      .filter(([, a]) => a.score !== null && (a.score ?? 1) < 0.9)
      .sort(([, a], [, b]) => (a.score ?? 1) - (b.score ?? 1))
      .slice(0, 15)
      .map(([id, a]): AuditItem => ({
        id,
        title: a.title ?? id,
        description: a.description ?? '',
        score: a.score ?? null,
        displayValue: a.displayValue,
        impact: this.scoreToImpact(a.score ?? null),
      }));
  }

  private toScore(raw: number | null | undefined): number {
    return Math.round((raw ?? 0) * 100);
  }

  private scoreToImpact(score: number | null): AuditImpact {
    if (score === null) return 'low';
    if (score < 0.25) return 'critical';
    if (score < 0.5) return 'high';
    if (score < 0.75) return 'medium';
    return 'low';
  }

  private parseTimeline(lhr: RunnerResult['lhr']): TimelineData | null {
    try {
      const filmstripAudit = lhr.audits['screenshot-thumbnails'];
      const metricsAudit   = lhr.audits['metrics'];

      if (!filmstripAudit?.details || !metricsAudit?.details) return null;

      const filmstrip = filmstripAudit.details as {
        type: string;
        items: Array<{ timing?: number; timestamp?: number; data?: string }>;
      };
      if (filmstrip.type !== 'filmstrip' || !Array.isArray(filmstrip.items)) return null;

      const frames: TimelineFrame[] = filmstrip.items
        .filter((item) => !!item.data)
        .map((item) => ({
          timing: item.timing ?? (item.timestamp !== undefined ? Math.round(item.timestamp / 1000) : 0),
          data:   item.data as string,
        }));

      if (frames.length === 0) return null;

      const metricsDetails = metricsAudit.details as {
        type: string;
        items: Array<Record<string, number>>;
      };
      const m = metricsDetails?.items?.[0] ?? {};

      let networkOffsetMs = 0;
      try {
        const netAudit     = lhr.audits['network-requests'];
        const debugData    = (netAudit?.details as Record<string, unknown> | undefined)?.debugData as Record<string, unknown> | undefined;
        const networkStartTs = debugData?.networkStartTimeTs as number | undefined;
        const firstRaw     = filmstrip.items.find(i => !!i.data);
        if (networkStartTs !== undefined && firstRaw?.timestamp !== undefined) {
          const navStartTs = firstRaw.timestamp - (firstRaw.timing ?? 0) * 1000;
          networkOffsetMs  = Math.max(0, Math.min((networkStartTs - navStartTs) / 1000, 2000));
        }
      } catch {
        networkOffsetMs = 0;
      }

      const lastFrameMs = frames.at(-1)!.timing;
      const clampToFilmstrip = (val: number) => val > 0 && val > lastFrameMs ? lastFrameMs : val;

      return {
        frames,
        metrics: {
          fcp: clampToFilmstrip(m.firstContentfulPaint   ?? 0),
          lcp: clampToFilmstrip(m.largestContentfulPaint ?? 0),
          tti: clampToFilmstrip(m.interactive            ?? 0),
          tbt: m.totalBlockingTime ?? 0,
        },
        networkOffsetMs,
      };
    } catch {
      return null;
    }
  }

  private parseCLSData(lhr: RunnerResult['lhr']): CLSData | null {
    try {
      const clsAudit  = lhr.audits['cumulative-layout-shift'];
      // Lighthouse v12 uses 'layout-shifts'; earlier versions used 'layout-shift-elements'
      const shiftAudit = lhr.audits['layout-shifts'] ?? lhr.audits['layout-shift-elements'];
      if (!clsAudit || !shiftAudit?.details) return null;

      const totalScore = clsAudit.numericValue ?? 0;
      if (totalScore < 0.001) return null;

      const details = shiftAudit.details as { type: string; items: unknown[] };
      if (details.type !== 'table' || !Array.isArray(details.items) || details.items.length === 0) return null;

      // Viewport dimensions: prefer configSettings.screenEmulation, else Puppeteer default
      const cfgAny    = lhr.configSettings as unknown as Record<string, unknown> | undefined;
      const emulation = cfgAny?.['screenEmulation'] as Record<string, unknown> | undefined;
      const vw = typeof emulation?.['width']  === 'number' ? (emulation['width']  as number) : 800;
      const vh = typeof emulation?.['height'] === 'number' ? (emulation['height'] as number) : 600;

      const elements: CLSShiftElement[] = details.items
        .map((item: unknown): CLSShiftElement | null => {
          const row  = item as Record<string, unknown>;
          const node = row['node'] as Record<string, unknown> | undefined;
          // In Lighthouse v12 'layout-shifts', the node is the biggest-impact element.
          // Some shift events have no identified DOM element — skip those.
          if (!node || typeof node['selector'] !== 'string') return null;

          const score = ((row['score'] ?? row['cumulativeShiftScore'] ?? 0) as number);
          const br    = node['boundingRect'] as Record<string, number | undefined> | undefined;

          // Extract root cause from Lighthouse v12 subItems
          type SubItemRaw = { cause?: { value?: string } };
          const subItems = (row['subItems'] as { items?: SubItemRaw[] } | undefined)?.items ?? [];
          let rootCause: string | undefined;
          if (subItems.length > 0 && subItems[0]) {
            const causeStr = (subItems[0].cause?.value ?? '').toLowerCase();
            if (causeStr.includes('media') || causeStr.includes('size'))  rootCause = 'unsized-media';
            else if (causeStr.includes('font'))                           rootCause = 'web-font';
            else if (causeStr.includes('iframe'))                         rootCause = 'injected-iframe';
          }

          const el: CLSShiftElement = {
            selector: node['selector'] as string,
            snippet:  (node['snippet'] ?? '') as string,
            score,
            impact: score >= 0.05 ? 'high' : score >= 0.015 ? 'medium' : 'low',
            ...(rootCause ? { rootCause } : {}),
          };

          if (br && typeof br['top'] === 'number') {
            const top    = br['top']    ?? 0;
            const left   = br['left']   ?? 0;
            const width  = br['width']  ?? 0;
            const height = br['height'] ?? 0;
            el.rect = {
              topPct:    Math.max(0, Math.min(top    / vh, 1)),
              leftPct:   Math.max(0, Math.min(left   / vw, 1)),
              widthPct:  Math.max(0, Math.min(width  / vw, 1)),
              heightPct: Math.max(0, Math.min(height / vh, 1)),
            };
          }
          return el;
        })
        .filter(Boolean) as CLSShiftElement[];

      if (elements.length === 0) return null;
      return { totalScore, elements, viewportWidth: vw, viewportHeight: vh };
    } catch {
      return null;
    }
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
