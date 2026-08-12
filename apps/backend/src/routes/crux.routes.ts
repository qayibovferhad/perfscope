import { Router } from 'express';
import { CruxService } from '../services/crux.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import type { AuditFormFactor } from '../types/index.js';

export const cruxRouter: Router = Router();

// GET /api/crux?url=...&formFactor=mobile|desktop — real-user field data for a page.
// No user data is involved, but the lookup spends the server's CRUX_API_KEY quota, so it
// is for signed-in users. (It was already gated in practice by an unscoped requireAuth in
// a router mounted earlier; this makes it explicit.)
cruxRouter.get(
  '/crux',
  requireAuth,
  asyncHandler(async (req, res) => {
    const url = req.query['url'];
    if (!url || typeof url !== 'string') throw new AppError(400, 'url query param required');

    const raw = req.query['formFactor'];
    const formFactor: AuditFormFactor = raw === 'desktop' ? 'desktop' : 'mobile';

    res.json({ success: true, data: await CruxService.get(url, formFactor) });
  }, 'Failed to load field data'),
);
