import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { Website } from '../models/Website.model.js';
import { HistoryModel } from '../models/History.model.js';
import { RumEvent } from '../models/RumEvent.model.js';
import type { OnboardingStatus, OnboardingStepId } from '@perfscope/shared';

export const onboardingRouter = Router();

/** Ceiling on the evidence counts — past this the exact number tells the user nothing. */
const COUNT_CAP = 1000;

/**
 * GET /api/onboarding/status — how far the account has actually got.
 *
 * Every step is answered by a count, not by a stored flag. A user who added a site
 * through the CLI, or whose data was imported, is as far along as one who clicked
 * through the UI — and a step that is later undone (every site deleted) correctly goes
 * back to incomplete.
 */
onboardingRouter.get('/onboarding/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const sites = await Website.find({ userId })
      .select('_id automation budgets rumKey')
      .lean();

    const siteIds = sites.map(s => s._id);

    // Capped: the panel needs "any, and roughly how many" — never an exact total. RumEvent
    // is the high-cardinality collection here (one row per page view), and this runs on
    // every visit to /websites, so an unbounded count would be the expensive part of a
    // checklist that retires itself. Counts at the cap are rendered as "1000+".
    const [audits, rumPageViews] = await Promise.all([
      HistoryModel.countDocuments({ userId }, { limit: COUNT_CAP }),
      siteIds.length
        ? RumEvent.countDocuments({ websiteId: { $in: siteIds } }, { limit: COUNT_CAP })
        : Promise.resolve(0),
    ]);

    const steps: Record<OnboardingStepId, boolean> = {
      website:    sites.length > 0,
      audit:      audits > 0,
      automation: sites.some(s => s.automation?.enabled),
      // A budget with nowhere to send is only half the step: the point is being told.
      budget:     sites.some(s => s.budgets && (s.budgets.webhookUrl || s.budgets.alertEmail)),
      // The snippet only counts once a real page view has arrived — issuing a key proves
      // nothing about whether it was ever pasted into the site.
      rum:        rumPageViews > 0,
    };

    const status: OnboardingStatus = {
      steps,
      counts: { websites: sites.length, audits, rumPageViews },
      complete: Object.values(steps).every(Boolean),
    };

    return res.json({ success: true, data: status });
  } catch (err) {
    console.error('[onboarding]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});
