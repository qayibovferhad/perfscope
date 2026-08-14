import { Router } from 'express';
import { parseFormFactor } from '../lib/params.js';
import { CruxService } from '../services/crux.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import type { AuditFormFactor } from '@perfscope/shared';

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

    // Mobile unless desktop was asked for — CrUX grades mobile-first.
    const formFactor: AuditFormFactor = parseFormFactor(req.query['formFactor']) ?? 'mobile';

    res.json({ success: true, data: await CruxService.get(url, formFactor) });
  }, 'Failed to load field data'),
);
