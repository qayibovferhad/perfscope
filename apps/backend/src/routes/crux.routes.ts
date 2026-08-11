import { Router, type Request, type Response } from 'express';
import { CruxService } from '../services/crux.service.js';
import type { AuditFormFactor } from '../types/index.js';

export const cruxRouter: Router = Router();

// GET /api/crux?url=...&formFactor=mobile|desktop — real-user field data for a page.
// Public like GET /api/history: no user data is involved, the URL is the whole query.
cruxRouter.get('/crux', async (req: Request, res: Response) => {
  const url = req.query['url'];
  if (!url || typeof url !== 'string') {
    res.status(400).json({ success: false, error: 'url query param required' });
    return;
  }

  const raw = req.query['formFactor'];
  const formFactor: AuditFormFactor = raw === 'desktop' ? 'desktop' : 'mobile';

  try {
    const data = await CruxService.get(url, formFactor);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[crux]', err);
    res.status(500).json({ success: false, error: 'Failed to load field data' });
  }
});
