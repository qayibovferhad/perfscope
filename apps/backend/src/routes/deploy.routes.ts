import { Router } from 'express';
import { Types } from 'mongoose';
import { ok } from '../lib/respond.js';
import { intParam } from '../lib/params.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { emptyOnNoStorage, requireStorageForWrites } from '../middleware/storage.middleware.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { Website } from '../models/Website.model.js';
import { Deploy, type IDeploy } from '../models/Deploy.model.js';
import type { Deploy as DeployDto } from '@perfscope/shared';

export const deployRouter: Router = Router();

/** A deploy older than this is not on any chart the app draws. */
const MAX_WINDOW_DAYS = 365;

const toDto = (d: IDeploy): DeployDto => ({
  _id:       String(d._id),
  websiteId: String(d.websiteId),
  at:        d.at.toISOString(),
  ...(d.ref   ? { ref:   d.ref }   : {}),
  ...(d.label ? { label: d.label } : {}),
  ...(d.url   ? { url:   d.url }   : {}),
  createdAt: d.createdAt.toISOString(),
});

/** The caller's own site, or a 404 — never "forbidden", which confirms the id exists. */
async function ownedSiteId(req: AuthedRequest): Promise<Types.ObjectId> {
  const site = await Website.findOne({ _id: req.params['id']!, userId: req.userId })
    .select('_id').lean<{ _id: Types.ObjectId }>();
  if (!site) throw new AppError(404, 'Website not found');
  return site._id;
}

/**
 * GET /api/websites/:id/deploys — the releases to draw on this site's charts.
 *
 * Scoped to the same window the chart is showing, because a marker outside the plotted
 * range is a row fetched to be thrown away.
 */
deployRouter.get(
  '/websites/:id/deploys',
  requireAuth,
  emptyOnNoStorage(() => []),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const websiteId = await ownedSiteId(req);
    const days = intParam(req.query['days'], { def: 90, min: 1, max: MAX_WINDOW_DAYS });
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await Deploy.find({ websiteId, at: { $gte: since } })
      .sort({ at: -1 }).limit(200).lean<IDeploy[]>();

    ok(res, rows.map(toDto));
  }),
);

/**
 * POST /api/websites/:id/deploys — "we just shipped".
 *
 * Meant for a pipeline, so it is forgiving: no body at all records a deploy at the moment
 * the request arrived, which is the truth for a step that runs right after a release.
 *
 * A `ref` makes the write idempotent for that site. CI retries — a flaky notify step that
 * runs twice should leave one marker on the chart, not two on the same line.
 */
deployRouter.post(
  '/websites/:id/deploys',
  requireAuth,
  requireStorageForWrites,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const websiteId = await ownedSiteId(req);
    const body = (req.body ?? {}) as Record<string, unknown>;

    const str = (v: unknown, max: number) =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

    const atRaw = str(body['at'], 40);
    const at = atRaw ? new Date(atRaw) : new Date();
    if (Number.isNaN(at.getTime())) throw new AppError(400, '`at` is not a date');

    const ref = str(body['ref'], 200);
    const doc = {
      userId: new Types.ObjectId(req.userId), websiteId, at,
      ref, label: str(body['label'], 120), url: str(body['url'], 500),
    };

    // Upsert on the ref when there is one, so a retried pipeline step is not a second
    // marker; otherwise every call is its own deploy, because that is all we can know.
    const saved = ref
      ? await Deploy.findOneAndUpdate({ websiteId, ref }, doc, { upsert: true, new: true, setDefaultsOnInsert: true }).lean<IDeploy>()
      : await Deploy.create(doc).then(d => d.toObject() as IDeploy);

    ok(res, toDto(saved!), 201);
  }),
);

/** DELETE /api/deploys/:id — a marker recorded by mistake, or against the wrong site. */
deployRouter.delete(
  '/deploys/:id',
  requireAuth,
  requireStorageForWrites,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const gone = await Deploy.findOneAndDelete({ _id: req.params['id']!, userId: req.userId }).lean<IDeploy>();
    if (!gone) throw new AppError(404, 'Deploy not found');
    ok(res, null);
  }),
);
