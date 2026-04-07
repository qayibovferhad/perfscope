import { EventEmitter } from 'events';
import puppeteer, { type Browser } from 'puppeteer';
import lighthouse, { type RunnerResult } from 'lighthouse';
import { v4 as uuidv4 } from 'uuid';
import type {
  AnalysisResult,
  AnalysisProgress,
  AuditItem,
  AuditImpact,
  AnalysisCategory,
  CategoryPartial,
} from '../types/index.js';

interface ActiveAnalysis {
  browser: Browser;
  abortController: AbortController;
}

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
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
      return this.buildFullResult(analysisId, url, [runnerResult]);
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
  // Single Lighthouse run (same speed as before). After completion, emits
  // each category as a separate partial with a small stagger for skeleton UX.

  async analyzeStreaming(
    url: string,
    onPartial: (partial: CategoryPartial) => void,
  ): Promise<AnalysisResult> {
    const analysisId = uuidv4();
    let browser: Browser | null = null;

    try {
      browser = await this.launchBrowser(analysisId);
      const runnerResult = await this.runLighthouse(url, analysisId, browser, CATEGORIES);
      const categoryResults = [runnerResult];

      // Emit partials staggered so skeleton cards fill in one by one
      const orderedCategories: AnalysisCategory[] = [
        'seo', 'best-practices', 'accessibility', 'performance',
      ];
      for (const category of orderedCategories) {
        onPartial(this.buildPartial(analysisId, category, runnerResult));
        await new Promise((r) => setTimeout(r, 350));
      }

      this.emitProgress(analysisId, 'processing', 90, 'Finalizing results...');
      const full = this.buildFullResult(analysisId, url, categoryResults);
      this.emitProgress(analysisId, 'complete', 100, 'Analysis completed successfully!');
      return full;
    } finally {
      if (browser) await browser.close().catch(() => void 0);
    }
  }

  cancelAnalysis(analysisId: string): boolean {
    const analysis = this.activeAnalyses.get(analysisId);
    if (!analysis) return false;
    analysis.abortController.abort();
    analysis.browser.close().catch(() => void 0);
    this.activeAnalyses.delete(analysisId);
    return true;
  }

  // ─── Private: Browser ────────────────────────────────────────────────────

  private async launchBrowser(analysisId: string): Promise<Browser> {
    this.emitProgress(analysisId, 'launching', 10, 'Launching Chrome browser...');
    const browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });
    this.activeAnalyses.set(analysisId, { browser, abortController: new AbortController() });
    this.emitProgress(analysisId, 'navigating', 25, 'Browser ready...');
    return browser;
  }

  private async runLighthouse(
    url: string,
    analysisId: string,
    browser: Browser,
    categories: AnalysisCategory[],
  ): Promise<RunnerResult> {
    this.emitProgress(analysisId, 'auditing', 45, 'Running Lighthouse audit...');
    const port = Number(new URL(browser.wsEndpoint()).port);

    const result = await lighthouse(url, {
      port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: categories,
      screenEmulation: { disabled: true },
    });

    if (!result) throw new Error('Lighthouse returned no result');
    this.emitProgress(analysisId, 'processing', 80, 'Processing results...');
    return result;
  }

  // ─── Private: Transform ──────────────────────────────────────────────────

  private buildPartial(
    analysisId: string,
    category: AnalysisCategory,
    runnerResult: RunnerResult,
  ): CategoryPartial {
    const { lhr } = runnerResult;
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
    results: RunnerResult[],
  ): AnalysisResult {
    // Merge all category LHRs into one result
    const scores = { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };
    const metrics = { fcp: 0, lcp: 0, tbt: 0, cls: 0, si: 0, tti: 0 };
    const allAudits: AuditItem[] = [];

    for (const { lhr } of results) {
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
      }

      allAudits.push(...this.extractFailingAudits(lhr.audits));
    }

    // Deduplicate audits by id
    const seen = new Set<string>();
    const uniqueAudits = allAudits.filter(({ id }) => seen.has(id) ? false : (seen.add(id), true));

    return { id, url, timestamp: new Date().toISOString(), scores, metrics, audits: uniqueAudits };
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
