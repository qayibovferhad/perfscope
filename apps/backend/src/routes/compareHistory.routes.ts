import { Router, type Request, type Response } from 'express';
import { CompareHistoryService } from '../services/compareHistory.service.js';

export const compareHistoryRouter: Router = Router();

// GET /api/compare-history — list unique pairs (latest per pair)
compareHistoryRouter.get('/compare-history', async (req: Request, res: Response) => {
  try {
    const search = typeof req.query['search'] === 'string'
      ? (req.query['search'] as string) : undefined;
    const data   = await CompareHistoryService.listPairs(search);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load compare history' });
  }
});

// GET /api/compare-history/:pairId — full trend for a pair
compareHistoryRouter.get('/compare-history/:pairId', async (req: Request, res: Response) => {
  try {
    const pairId = String(req.params['pairId'] ?? '');
    const data   = await CompareHistoryService.getPair(pairId);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load pair history' });
  }
});

// POST /api/compare-history — save a new comparison result
compareHistoryRouter.post('/compare-history', async (req: Request, res: Response) => {
  const { sourceUrl, targetUrl, source, competitor } = req.body as {
    sourceUrl: string; targetUrl: string;
    source: { scores: Record<string, number>; metrics: Record<string, number> };
    competitor: { scores: Record<string, number>; metrics: Record<string, number> };
  };

  if (!sourceUrl || !targetUrl || !source || !competitor) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }
  try {
    await CompareHistoryService.save(sourceUrl, targetUrl, source, competitor);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save comparison' });
  }
});
