import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { Website } from '../models/Website.model.js';
import { HistoryModel } from '../models/History.model.js';
import type { OnboardingStatus, OnboardingStepId } from '@perfscope/shared';
import { isDbReady } from '../config/database.js';

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

    // Nothing stored means no step can have been completed — the checklist is exactly
    // right in that state, and far better than the dashboard reporting a failure.
    if (!isDbReady()) {
      const status: OnboardingStatus = {
        steps:    { website: false, audit: false, automation: false },
        counts:   { websites: 0, audits: 0 },
        complete: false,
      };
      return res.json({ success: true, data: status });
    }

    const sites = await Website.find({ userId })
      .select('_id automation')
      .lean();

    // Capped: the panel needs "any, and roughly how many" — never an exact total, and
    // this runs on every dashboard visit. Counts at the cap are rendered as "1000+".
    const audits = await HistoryModel.countDocuments({ userId }, { limit: COUNT_CAP });

    const steps: Record<OnboardingStepId, boolean> = {
      website:    sites.length > 0,
      audit:      audits > 0,
      automation: sites.some(s => s.automation?.enabled),
    };

    const status: OnboardingStatus = {
      steps,
      counts: { websites: sites.length, audits },
      complete: Object.values(steps).every(Boolean),
    };

    return res.json({ success: true, data: status });
  } catch (err) {
    console.error('[onboarding]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});
