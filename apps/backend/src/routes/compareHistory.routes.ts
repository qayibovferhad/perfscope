import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { CompareHistoryService } from '../services/compareHistory.service.js';
import { emptyOnNoStorage, requireStorageForWrites } from '../middleware/storage.middleware.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { AppError, asyncHandler } from '../lib/errors.js';

export const compareHistoryRouter: Router = Router();

// Path-scoped on purpose: every router is mounted at the bare `/api` prefix in app.ts, so
// an unscoped `.use()` here would also run for every request that merely passes through on
// its way to a router mounted later — an unscoped requireAuth silently locked the public
// CLI login handshake (/api/auth/cli/init) behind a token.

// Saving a comparison needs somewhere to save it; listing past ones does not.
compareHistoryRouter.use('/compare-history', requireStorageForWrites);

// Comparisons are a user's own work. Every route here used to be open and every query
// unscoped, so each account was shown every other account's comparisons.
compareHistoryRouter.use('/compare-history', requireAuth);

// GET /api/compare-history — list unique pairs (latest per pair)
compareHistoryRouter.get(
  '/compare-history',
  emptyOnNoStorage(() => []),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const search = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
    ok(res, await CompareHistoryService.listPairs(req.userId, search));
  }, 'Failed to load compare history'),
);

// GET /api/compare-history/:pairId — full trend for a pair
compareHistoryRouter.get(
  '/compare-history/:pairId',
  emptyOnNoStorage(() => []),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const pairId = String(req.params['pairId'] ?? '');
    ok(res, await CompareHistoryService.getPair(req.userId, pairId));
  }, 'Failed to load pair history'),
);

// POST /api/compare-history — save a new comparison result
compareHistoryRouter.post(
  '/compare-history',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { sourceUrl, targetUrl, source, competitor, sourceAnalysisId, competitorAnalysisId } = req.body as {
      sourceUrl: string; targetUrl: string;
      source: { scores: Record<string, number>; metrics: Record<string, number> };
      competitor: { scores: Record<string, number>; metrics: Record<string, number> };
      /** Optional: lets the verdict cite this side's actual failing audits/resources/
       *  vendors instead of only the eight numbers below. Omitted for an uploaded or
       *  preloaded side, which may not be a `History` row this user owns. */
      sourceAnalysisId?: string;
      competitorAnalysisId?: string;
    };

    if (!sourceUrl || !targetUrl || !source || !competitor) {
      throw new AppError(400, 'Missing required fields');
    }

    // Returned as well as stored, so the page that just triggered the save can show the
    // verdict without a second round trip.
    const aiVerdict = await CompareHistoryService.save(
      req.userId, sourceUrl, targetUrl, source, competitor, sourceAnalysisId, competitorAnalysisId,
    );
    ok(res, { aiVerdict });
  }, 'Failed to save comparison'),
);
