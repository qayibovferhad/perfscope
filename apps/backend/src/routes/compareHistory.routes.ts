import { Router, type Response } from 'express';
import { CompareHistoryService } from '../services/compareHistory.service.js';
import { requireStorageForWrites } from '../middleware/storage.middleware.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { isDbReady } from '../config/database.js';

export const compareHistoryRouter: Router = Router();

// Saving a comparison needs somewhere to save it; listing past ones does not.
compareHistoryRouter.use(requireStorageForWrites);

// Comparisons are a user's own work. Every route here used to be open and every query
// unscoped, so each account was shown every other account's comparisons.
compareHistoryRouter.use(requireAuth);

// GET /api/compare-history — list unique pairs (latest per pair)
compareHistoryRouter.get('/compare-history', async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbReady()) {
      res.json({ success: true, data: [] });
      return;
    }
    const search = typeof req.query['search'] === 'string'
      ? (req.query['search'] as string) : undefined;
    const data   = await CompareHistoryService.listPairs(req.userId!, search);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[compareHistory]', err);
    res.status(500).json({ success: false, error: 'Failed to load compare history' });
  }
});

// GET /api/compare-history/:pairId — full trend for a pair
compareHistoryRouter.get('/compare-history/:pairId', async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbReady()) {
      res.json({ success: true, data: [] });
      return;
    }
    const pairId = String(req.params['pairId'] ?? '');
    const data   = await CompareHistoryService.getPair(req.userId!, pairId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[compareHistory]', err);
    res.status(500).json({ success: false, error: 'Failed to load pair history' });
  }
});

// POST /api/compare-history — save a new comparison result
compareHistoryRouter.post('/compare-history', async (req: AuthRequest, res: Response) => {
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
    await CompareHistoryService.save(req.userId!, sourceUrl, targetUrl, source, competitor);
    res.json({ success: true });
  } catch (err) {
    console.error('[compareHistory]', err);
    res.status(500).json({ success: false, error: 'Failed to save comparison' });
  }
});
