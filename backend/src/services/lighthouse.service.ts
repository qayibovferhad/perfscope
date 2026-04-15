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
      const flameChartData = traces ? (parseFlameChart(traces, maxMs) ?? undefined) : undefined;
      return this.buildFullResult(analysisId, url, [runnerResult.lhr], flameChartData, undefined, anyResult?.artifacts);
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
    // performance worker is run2; flame chart data comes from there
    const flameData = res2.flameChartData ?? res1.flameChartData;
    // Use network events from whichever worker captured them (prefer run2 for performance)
    const networkEvents = res2.networkEvents ?? res1.networkEvents;
    const full = this.buildFullResult(analysisId, url, [res1.lhr, res2.lhr], flameData, networkEvents);
    this.emitProgress(analysisId, 'complete', 100, 'Analysis completed successfully!');
    return full;
  }

  private runLighthouseInWorker(
    url: string,
    categories: string[],
    workerRegistry: Worker[],
  ): Promise<{ lhr: RunnerResult['lhr']; flameChartData?: FlameChartData; networkEvents?: CompactNetworkEvent[] }> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_URL, {
        workerData: { url, categories },
        execArgv: process.execArgv, // inherit tsx loader in dev
      });

      // Register immediately so cancelAnalysis can terminate this worker
      workerRegistry.push(worker);

      worker.once('message', (msg: { type: string; lhr?: RunnerResult['lhr']; compactTrace?: unknown; traceMaxMs?: number; networkEvents?: CompactNetworkEvent[]; message?: string }) => {
        if (msg.type === 'result' && msg.lhr) {
          const r: { lhr: RunnerResult['lhr']; flameChartData?: FlameChartData; networkEvents?: CompactNetworkEvent[] } = { lhr: msg.lhr };
          if (msg.compactTrace && msg.traceMaxMs != null) {
            const fc = parseFlameChart(msg.compactTrace, msg.traceMaxMs);
            if (fc) r.flameChartData = fc;
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
  ): Promise<RunnerResult> {
    const port = Number(new URL(browser.wsEndpoint()).port);

    const result = await lighthouse(url, {
      port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: categories,
      screenEmulation: { disabled: true },
      // Use real server speed instead of simulated mobile (4x CPU + slow 4G)
      // which was artificially inflating FCP/LCP to 40+ seconds
      throttlingMethod: 'provided',
    });

    if (!result) throw new Error('Lighthouse returned no result');
    return result;
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
    if (flameChartData) result.flameChartData = flameChartData;
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
