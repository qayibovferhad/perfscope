import { EventEmitter } from 'events';
import puppeteer, { type Browser } from 'puppeteer';
import lighthouse, { type RunnerResult } from 'lighthouse';
import { v4 as uuidv4 } from 'uuid';
import type {
  AnalysisResult,
  AnalysisProgress,
  AuditItem,
  AuditImpact,
} from '../types/index.js';

// ─── Internal State ──────────────────────────────────────────────────────────

interface ActiveAnalysis {
  browser: Browser;
  abortController: AbortController;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class LighthouseService extends EventEmitter {
  private readonly activeAnalyses = new Map<string, ActiveAnalysis>();

  // ─── Public API ─────────────────────────────────────────────────────────────

  async analyze(url: string): Promise<AnalysisResult> {
    const analysisId = uuidv4();
    let browser: Browser | null = null;

    try {
      browser = await this.launchBrowser(analysisId);
      const runnerResult = await this.runLighthouse(url, analysisId, browser);
      return this.transformResult(analysisId, url, runnerResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      this.emitProgress(analysisId, 'error', 0, `Error: ${message}`);
      throw err;
    } finally {
      if (browser) await browser.close().catch(() => void 0);
      this.activeAnalyses.delete(analysisId);
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

  // ─── Private: Browser ───────────────────────────────────────────────────────

  private async launchBrowser(analysisId: string): Promise<Browser> {
    this.emitProgress(analysisId, 'launching', 10, 'Launching Chrome browser...');

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    this.activeAnalyses.set(analysisId, {
      browser,
      abortController: new AbortController(),
    });

    this.emitProgress(analysisId, 'navigating', 25, 'Browser ready, validating URL...');
    return browser;
  }

  // ─── Private: Lighthouse ─────────────────────────────────────────────────────

  private async runLighthouse(
    url: string,
    analysisId: string,
    browser: Browser,
  ): Promise<RunnerResult> {
    this.emitProgress(analysisId, 'auditing', 45, 'Running Lighthouse audit...');

    const wsEndpoint = browser.wsEndpoint();
    const port = Number(new URL(wsEndpoint).port);

    const result = await lighthouse(url, {
      port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      screenEmulation: { disabled: true },
    });

    if (!result) {
      throw new Error('Lighthouse returned no result');
    }

    this.emitProgress(analysisId, 'processing', 80, 'Processing results...');
    return result;
  }

  // ─── Private: Transform ──────────────────────────────────────────────────────

  private transformResult(
    id: string,
    url: string,
    runnerResult: RunnerResult,
  ): AnalysisResult {
    const { lhr } = runnerResult;

    const result: AnalysisResult = {
      id,
      url,
      timestamp: new Date().toISOString(),
      scores: {
        performance: this.toScore(lhr.categories['performance']?.score),
        accessibility: this.toScore(lhr.categories['accessibility']?.score),
        bestPractices: this.toScore(lhr.categories['best-practices']?.score),
        seo: this.toScore(lhr.categories['seo']?.score),
      },
      metrics: {
        fcp: lhr.audits['first-contentful-paint']?.numericValue ?? 0,
        lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? 0,
        tbt: lhr.audits['total-blocking-time']?.numericValue ?? 0,
        cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? 0,
        si: lhr.audits['speed-index']?.numericValue ?? 0,
        tti: lhr.audits['interactive']?.numericValue ?? 0,
      },
      audits: this.extractFailingAudits(lhr.audits),
    };

    this.emitProgress(id, 'complete', 100, 'Analysis completed successfully!');
    return result;
  }

  private extractFailingAudits(
    audits: Record<string, { score?: number | null; title?: string; description?: string; displayValue?: string; details?: unknown }>,
  ): AuditItem[] {
    return Object.entries(audits)
      .filter(([, audit]) => audit.score !== null && (audit.score ?? 1) < 0.9)
      .sort(([, a], [, b]) => (a.score ?? 1) - (b.score ?? 1))
      .slice(0, 15)
      .map(([id, audit]): AuditItem => ({
        id,
        title: audit.title ?? id,
        description: audit.description ?? '',
        score: audit.score ?? null,
        displayValue: audit.displayValue,
        impact: this.scoreToImpact(audit.score ?? null),
      }));
  }

  // ─── Private: Helpers ────────────────────────────────────────────────────────

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
    const payload: AnalysisProgress = { analysisId, stage, progress, message };
    this.emit('progress', payload);
  }
}

// Singleton — one instance shared across the app
export const lighthouseService = new LighthouseService();
