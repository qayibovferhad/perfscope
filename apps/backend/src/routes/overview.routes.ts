import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { emptyOverview, getOverview } from '../services/overview.service.js';
import { emptyOnNoStorage } from '../middleware/storage.middleware.js';
import { asyncHandler } from '../lib/errors.js';
import { intParam } from '../lib/params.js';
import { DEFAULT_OVERVIEW_WINDOW } from '@perfscope/shared';

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
    // `days` is validated against the shared list rather than clamped: an unrecognised
    // window is a client sending something the product does not offer, and quietly
    // answering with a different one hides that.
    ok(res, await getOverview(req.userId, {
      days: intParam(req.query['days'], { def: DEFAULT_OVERVIEW_WINDOW, min: 1, max: 365 }),
      websiteId: typeof req.query['websiteId'] === 'string' && /^[a-f\d]{24}$/i.test(req.query['websiteId'])
        ? req.query['websiteId']
        : undefined,
    }));
  }),
);
