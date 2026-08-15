import { Router, type Request, type Response } from 'express';
import { ok } from '../lib/respond.js';
import { randomBytes } from 'node:crypto';
import { HistoryModel } from '../models/History.model.js';
import { HistoryService } from '../services/history.service.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import {
  requireStorage, requireStorageForWrites, emptyOnNoStorage,
} from '../middleware/storage.middleware.js';
import { AppError, asyncHandler } from '../lib/errors.js';

export const historyRouter: Router = Router();

/** A share token is 16 random bytes rendered as hex — the pattern below must match. */
const SHARE_TOKEN_BYTES = 16;
const SHARE_TOKEN_RE    = /^[a-f0-9]{32}$/;

// Path-scoped because every router shares the bare `/api` mount in app.ts: an unscoped
// `.use()` would also intercept requests bound for routers mounted after this one.

// Deleting an audit or minting a share link needs a database; listing does not — with no
// database there is simply no history, which every listing here reports as an empty list.
historyRouter.use(['/history', '/projects'], requireStorageForWrites);

// GET /api/public/report/:token — no auth; the unguessable token IS the credential.
// Mounted before the router-wide requireAuth below — it is the one public route here.
historyRouter.get(
  '/public/report/:token',
  requireStorage,
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.params['token'] ?? '');
    // A malformed token is answered as "not found" rather than "bad request": telling
    // the difference would confirm which tokens are the right shape.
    if (!SHARE_TOKEN_RE.test(token)) throw new AppError(404, 'Report not found');

    const doc = await HistoryModel.findOne({ shareToken: token }).lean();
    if (!doc?.fullResult) throw new AppError(404, 'Report not found');

    ok(res, { result: doc.fullResult, sharedAt: doc.createdAt });
  }, 'Failed to load report'),
);

// Everything under /history and /projects is per-user data. Router-level so a newly
// added route cannot be forgotten and ship unauthenticated; /public stays outside.
historyRouter.use(['/history', '/projects'], requireAuth);

// GET /api/history/all  — all entries for authenticated user
historyRouter.get(
  '/history/all',
  emptyOnNoStorage(() => []),
  asyncHandler<AuthedRequest>(async (req, res) => {
    ok(res, await HistoryService.getAll(req.userId));
  }, 'Failed to load history'),
);

// GET /api/history/scheduled — what the automation ran, grouped by site and route.
// Declared before /history/:id so the literal path is not read as an analysis id.
historyRouter.get(
  '/history/scheduled',
  emptyOnNoStorage(() => []),
  asyncHandler<AuthedRequest>(async (req, res) => {
    ok(res, await HistoryService.getScheduled(req.userId));
  }, 'Failed to load scheduled runs'),
);

// GET /api/history?url=...  — entries for a specific URL
historyRouter.get(
  '/history',
  emptyOnNoStorage(() => []),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const url = req.query['url'];
    if (!url || typeof url !== 'string') throw new AppError(400, 'url query param required');

    ok(res, await HistoryService.get(url, req.userId));
  }, 'Failed to load history'),
);

// ─── Share links ─────────────────────────────────────────────────────────────

// POST /api/history/:id/share — mint (or return) a public link token for an audit
historyRouter.post(
  '/history/:id/share',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const doc = await HistoryModel.findOne({
      analysisId: String(req.params['id']),
      userId:     req.userId,
    });
    if (!doc) throw new AppError(404, 'Audit not found');
    if (!doc.fullResult) throw new AppError(409, 'Full result not stored for this audit');

    if (!doc.shareToken) {
      doc.shareToken = randomBytes(SHARE_TOKEN_BYTES).toString('hex');
      await doc.save();
    }
    ok(res, { token: doc.shareToken });
  }, 'Failed to create share link'),
);

// DELETE /api/history/:id/share — revoke the public link
historyRouter.delete(
  '/history/:id/share',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await HistoryModel.updateOne(
      { analysisId: String(req.params['id']), userId: req.userId },
      { shareToken: null },
    );
    ok(res);
  }, 'Failed to revoke share link'),
);

// GET /api/history/:id  — full analysis result for a single audit
historyRouter.get(
  '/history/:id',
  requireStorage,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const data = await HistoryService.getById(String(req.params['id']), req.userId);
    if (!data) throw new AppError(404, 'Not found or result not stored');

    ok(res, data);
  }, 'Failed to load result'),
);

// DELETE /api/history/:id  — remove a single audit
historyRouter.delete(
  '/history/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const deleted = await HistoryService.remove(String(req.params['id']), req.userId);
    if (!deleted) throw new AppError(404, 'Audit not found');

    ok(res);
  }, 'Failed to delete audit'),
);

// GET /api/projects/:id/audits  — project audit history grouped by route
// A single project, unlike a listing, cannot be answered without the database: "no
// project" and "cannot look" are different answers and only one of them is true.
historyRouter.get(
  '/projects/:id/audits',
  requireStorage,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const data = await HistoryService.getByProject(String(req.params['id']), req.userId);
    if (!data) throw new AppError(404, 'Project not found');

    ok(res, data);
  }, 'Failed to load project audits'),
);
