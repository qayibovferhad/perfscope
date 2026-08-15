import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { emptyOverview, getOverview } from '../services/overview.service.js';
import { emptyOnNoStorage } from '../middleware/storage.middleware.js';
import { asyncHandler } from '../lib/errors.js';

export const overviewRouter: Router = Router();

/**
 * GET /api/overview — the account at a glance.
 *
 * One request rather than one per site: the dashboard ranks alerts, audits and field
 * traffic across every site, and none of that can be ordered until all of it has landed.
 *
 * With no database the account demonstrably has nothing — the panels say so themselves.
 * Failing here turned a disabled optional feature into a page-wide outage.
 */
overviewRouter.get(
  '/overview',
  requireAuth,
  emptyOnNoStorage(emptyOverview),
  asyncHandler<AuthedRequest>(async (req, res) => {
    ok(res, await getOverview(req.userId));
  }),
);
