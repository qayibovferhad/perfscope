import { Router, type Request, type Response } from 'express';
import { lighthouseService } from '../services/lighthouse.service.js';
import type {
  StartAnalysisBody,
  ApiResponse,
  StartAnalysisResponse,
  AnalysisResult,
} from '../types/index.js';

export const analysisRouter = Router();

// ─── POST /api/analysis ───────────────────────────────────────────────────────
// Trigger an analysis and stream progress via REST (fire-and-forget pattern).
// For real-time progress, prefer the WebSocket interface.

analysisRouter.post(
  '/',
  async (
    req: Request<object, ApiResponse<StartAnalysisResponse>, StartAnalysisBody>,
    res: Response<ApiResponse<StartAnalysisResponse>>,
  ) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'url field is required' });
      return;
    }

    try {
      new URL(url);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid URL format' });
      return;
    }

    // Fire the analysis in the background; client should listen via WebSocket
    lighthouseService.analyze(url).catch((err: unknown) => {
      console.error('[Analysis] Background analysis failed:', err);
    });

    res.status(202).json({
      success: true,
      data: {
        analysisId: 'pending',
        message: 'Analysis started. Connect via WebSocket for real-time progress.',
      },
    });
  },
);

// ─── GET /api/analysis/health ─────────────────────────────────────────────────

analysisRouter.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});
