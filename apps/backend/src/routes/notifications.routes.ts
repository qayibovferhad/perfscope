import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { emptyOnNoStorage } from '../middleware/storage.middleware.js';
import { asyncHandler } from '../lib/errors.js';
import { intParam } from '../lib/params.js';
import { emptyNotifications, getNotifications, markNotificationsSeen } from '../services/notifications.service.js';

export const notificationsRouter: Router = Router();

/**
 * GET /api/notifications — what has been raised, newest first, and how much of it is new.
 *
 * Its own endpoint rather than a field on `/api/overview`: the bell lives in the shell, on
 * every page, and folding it into the dashboard's payload would make every route that is
 * not the dashboard pay for a query it never renders.
 *
 * With no database the account demonstrably has no alerts, which is what the empty shape
 * says — failing here would put an error badge in the shell on every page.
 */
notificationsRouter.get(
  '/notifications',
  requireAuth,
  emptyOnNoStorage(emptyNotifications),
  asyncHandler<AuthedRequest>(async (req, res) => {
    // The clamp lives in the shared helper; the service caps again on its own so a caller
    // that skips the route (a probe, a future socket push) cannot ask for the whole log.
    ok(res, await getNotifications(req.userId, intParam(req.query['limit'], { def: 20, min: 1, max: 50 })));
  }),
);

/**
 * POST /api/notifications/seen — everything up to now has been looked at.
 *
 * Deliberately not folded into the GET. Opening a dropdown and reading it are the same
 * act to a person but not to a page: React Query refetches on focus and on interval, and
 * a GET that cleared the badge would clear it while the tab sat in the background.
 */
notificationsRouter.post(
  '/notifications/seen',
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    ok(res, await markNotificationsSeen(req.userId));
  }),
);
