import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { emptyOverview, getOverview } from '../services/overview.service.js';
import { emptyOnNoStorage } from '../middleware/storage.middleware.js';
import { asyncHandler } from '../lib/errors.js';
import { intParam } from '../lib/params.js';
import { DEFAULT_OVERVIEW_WINDOW, MAX_RANGE_DAYS, isDayKey } from '@perfscope/shared';

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
    // Two ways to name a window, both resolved by the shared `resolveOverviewRange` inside
    // the service: `days` is the shorthand the presets produce, `from`/`to` is what the
    // date picker sends. Only well-formed day keys are passed on — a half-given or
    // malformed pair falls back to the shorthand rather than being answered with an error,
    // because these live in a URL a person can edit.
    const from = req.query['from'];
    const to   = req.query['to'];

    ok(res, await getOverview(req.userId, {
      days: intParam(req.query['days'], { def: DEFAULT_OVERVIEW_WINDOW, min: 1, max: MAX_RANGE_DAYS }),
      ...(isDayKey(from) ? { from } : {}),
      ...(isDayKey(to)   ? { to }   : {}),
      websiteId: typeof req.query['websiteId'] === 'string' && /^[a-f\d]{24}$/i.test(req.query['websiteId'])
        ? req.query['websiteId']
        : undefined,
    }));
  }),
);
