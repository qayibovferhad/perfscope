import { Router, type Request, type Response } from 'express';
import { CruxService } from '../services/crux.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { AuditFormFactor } from '../types/index.js';

export const cruxRouter: Router = Router();

// GET /api/crux?url=...&formFactor=mobile|desktop — real-user field data for a page.
// No user data is involved, but the lookup spends the server's CRUX_API_KEY quota, so it
// is for signed-in users. (It was already gated in practice by an unscoped requireAuth in
// a router mounted earlier; this makes it explicit.)
cruxRouter.get('/crux', requireAuth, async (req: Request, res: Response) => {
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
