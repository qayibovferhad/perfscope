import { Router, type Request, type Response } from 'express';
import { HistoryService } from '../services/history.service.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';

export const historyRouter = Router();

// GET /api/history/all  — all entries for authenticated user
historyRouter.get('/history/all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await HistoryService.getAll(req.userId!);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load history' });
  }
});

// GET /api/history?url=...  — entries for a specific URL
historyRouter.get('/history', async (req: Request, res: Response) => {
  const url = req.query['url'];
  if (!url || typeof url !== 'string') {
    res.status(400).json({ success: false, error: 'url query param required' });
    return;
  }
  try {
    const data = await HistoryService.get(url);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load history' });
  }
});

// GET /api/projects/:id/audits  — project audit history grouped by route
historyRouter.get('/projects/:id/audits', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await HistoryService.getByProject(String(req.params['id']), req.userId!);
    if (!data) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load project audits' });
  }
});
