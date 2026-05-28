import type { Response } from 'express';
import { AnalyzerService } from '../services/analyzer.service.js';
import { HistoryService }  from '../services/history.service.js';
import { Website }         from '../models/Website.model.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import type { ApiResponse, AnalysisResult } from '../types/index.js';

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
    req: AuthRequest,
    res: Response<ApiResponse<AnalysisResult>>,
  ): Promise<void> {
    const { url, projectId } = req.body as { url: string; projectId?: string };

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

      // Persist to history when a logged-in user sends the request (e.g. from the extension)
      if (req.userId) {
        AnalyzerController.persistForUser(result, req.userId, projectId).catch((err: unknown) => {
          console.error('[Analyzer] Failed to persist:', (err as Error).message);
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      const status = message.includes('timed out') ? 504 : 500;
      res.status(status).json({ success: false, error: message });
    }
  }

  private static async persistForUser(
    result: AnalysisResult,
    userId: string,
    projectId?: string,
  ): Promise<void> {
    // Resolve or auto-create the Website document for this URL
    const normalized = result.url.startsWith('http') ? result.url : `https://${result.url}`;
    let resolvedProjectId = projectId;

    if (!resolvedProjectId) {
      // No project explicitly selected — upsert a Website entry so the URL
      // appears in the user's websites list automatically
      const website = await Website.findOneAndUpdate(
        { userId, url: normalized },
        { $setOnInsert: { url: normalized, name: new URL(normalized).hostname } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
      resolvedProjectId = String(website!._id);
    }

    const entry = {
      id:        result.id,
      shortId:   result.id.slice(0, 8),
      url:       result.url,
      timestamp: result.timestamp,
      scores:    result.scores,
      metrics:   result.metrics,
    };
    await HistoryService.save(entry, userId, resolvedProjectId);
  }
}
