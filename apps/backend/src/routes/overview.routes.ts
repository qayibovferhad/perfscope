import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { emptyOverview, getOverview } from '../services/overview.service.js';
import { isDbReady } from '../config/database.js';

export const overviewRouter: Router = Router();

/**
 * GET /api/overview — the account at a glance.
 *
 * One request rather than one per site: the dashboard ranks alerts, audits and field
 * traffic across every site, and none of that can be ordered until all of it has landed.
 */
overviewRouter.get('/overview', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // With no database the account demonstrably has nothing — the panels below say so
    // themselves. Failing here turned a disabled optional feature into a page-wide outage.
    if (!isDbReady()) return res.json({ success: true, data: emptyOverview() });

    return res.json({ success: true, data: await getOverview(req.userId!) });
  } catch (err) {
    console.error('[overview]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});
