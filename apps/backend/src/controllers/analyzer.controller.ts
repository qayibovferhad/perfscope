import type { Response } from 'express';
import { AnalyzerService } from '../services/analyzer.service.js';
import { HistoryService }  from '../services/history.service.js';
import { Website }         from '../models/Website.model.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import type { ApiResponse, AnalysisResult } from '../types/index.js';

function isValidUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export class AnalyzerController {
  static async analyze(
    req: AuthRequest,
    res: Response<ApiResponse<AnalysisResult> & { savedToHistory?: boolean }>,
  ): Promise<void> {
    const { url } = req.body as { url: string };

    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'url field is required' });
      return;
    }

    if (!isValidUrl(url)) {
      res.status(400).json({ success: false, error: 'Invalid URL. Must start with http:// or https://' });
      return;
    }

    try {
      const result = await AnalyzerService.analyze(url);

      let savedToHistory = false;
      if (req.userId) {
        try {
          await AnalyzerController.persistForUser(result, req.userId);
          savedToHistory = true;
        } catch (err) {
          console.error('[Analyzer] History save failed:', (err as Error).message);
        }
      }

      res.json({ success: true, data: result, savedToHistory });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      res.status(500).json({ success: false, error: message });
    }
  }

  private static async persistForUser(
    result: AnalysisResult,
    userId: string,
  ): Promise<void> {
    const parsed   = new URL(result.url);
    const hostname = parsed.hostname;
    const baseUrl  = `${parsed.protocol}//${hostname}`;

    const allWebsites = await Website.find({ userId }).lean();
    console.log(`[Analyzer] userId=${userId} websites=${allWebsites.length}`, allWebsites.map(w => w.url));

    let website = allWebsites.find(w => {
      try { return new URL(w.url).hostname === hostname; }
      catch { return false; }
    });

    if (!website) {
      console.log(`[Analyzer] No match for hostname=${hostname}, creating new website`);
      website = await Website.create({ userId, url: baseUrl, name: hostname });
    } else {
      console.log(`[Analyzer] Matched website _id=${website._id} url=${website.url}`);
    }

    const entry = {
      id:        result.id,
      shortId:   result.id.slice(0, 8),
      url:       result.url,
      timestamp: result.timestamp,
      scores:    result.scores,
      metrics:   result.metrics,
    };

    const projectId = String(website._id);
    console.log(`[Analyzer] Saving history with projectId=${projectId}`);
    await HistoryService.save(entry, userId, projectId, result as unknown as Record<string, unknown>);
    console.log(`[Analyzer] History saved ✓`);
  }
}
