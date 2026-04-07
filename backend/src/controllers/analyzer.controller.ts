import type { Request, Response } from 'express';
import { AnalyzerService } from '../services/analyzer.service.js';
import type { ApiResponse, AnalysisResult, StartAnalysisBody } from '../types/index.js';

const ANALYSIS_TIMEOUT_MS = 60_000;

function isValidUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Analysis timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

export class AnalyzerController {
  static async analyze(
    req: Request<object, ApiResponse<AnalysisResult>, StartAnalysisBody>,
    res: Response<ApiResponse<AnalysisResult>>,
  ): Promise<void> {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'url field is required' });
      return;
    }

    if (!isValidUrl(url)) {
      res.status(400).json({ success: false, error: 'Invalid URL. Must start with http:// or https://' });
      return;
    }

    try {
      const result = await withTimeout(AnalyzerService.analyze(url), ANALYSIS_TIMEOUT_MS);
      res.json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      const status = message.includes('timed out') ? 504 : 500;
      res.status(status).json({ success: false, error: message });
    }
  }
}
