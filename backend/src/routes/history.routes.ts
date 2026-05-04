import { Router, type Request, type Response } from 'express';
import { HistoryService } from '../services/history.service.js';

export const historyRouter = Router();

historyRouter.get('/history', async (req: Request, res: Response) => {
  const url = req.query['url'];
  if (!url || typeof url !== 'string') {
    res.status(400).json({ success: false, error: 'url query param required' });
    return;
  }
  try {
    const data = await HistoryService.get(url);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load history' });
  }
});
