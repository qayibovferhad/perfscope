import { randomBytes } from 'node:crypto';
import { meanRounded } from '../lib/stats.js';
import { Router } from 'express';
import { SCORE_BANDS, RUM_METRIC_KEYS, type Paginated, type WebsiteSummary } from '@perfscope/shared';
import type { QueryFilter } from 'mongoose';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { Website, type IWebsite } from '../models/Website.model.js';
import { AlertLog } from '../models/AlertLog.model.js';
import { getRumSummary, getRumPaths, getRumTrend } from '../services/rum.service.js';
import { NightlyAuditService } from '../services/nightlyAudit.service.js';
import { escapeRegex, normalizeUrl as normalizeSiteUrl } from '../lib/url.js';
import { computeSiteScores } from '../services/overview.service.js';
import { parseAutomationUpdate, parseBudgets } from '../services/websiteInput.js';
import { isDbReady } from '../config/database.js';
import { requireStorageForWrites } from '../middleware/storage.middleware.js';
import { AppError, asyncHandler } from '../lib/errors.js';

export const websiteRouter: Router = Router();

// Path-scoped because every router shares the bare `/api` mount in app.ts: an unscoped
// `.use()` would also intercept requests bound for routers mounted after this one.

// Every route here is pure persistence: without a database a write cannot be honoured, and
// saying so beats a 500. Reads answer with their empty shape instead — see below.
websiteRouter.use('/websites', requireStorageForWrites);

// Every route here is per-user data. Router-level so a newly added route cannot be
// forgotten and ship unauthenticated.
websiteRouter.use('/websites', requireAuth);

const MAX_LIMIT      = 100;
const DEFAULT_LIMIT  = 12;
/** RUM windows: a week for the summary, a month for the trend line. */
const RUM_DAYS       = { summary: 7, trend: 30 };
const ALERTS_LIMIT   = { default: 20, max: 100 };
/** The RUM site key ships in the page source of whatever embeds the collector — it is an
 *  identifier, not a secret, so this is length enough to avoid collisions. */
const RUM_KEY_BYTES  = 12;

/** Owner scope plus an optional free-text filter over the site's label and URL. */
function ownedFilter(userId: string, q?: string): QueryFilter<Record<string, unknown>> {
  const filter: QueryFilter<Record<string, unknown>> = { userId };
  const term = q?.trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    filter['$or'] = [{ name: rx }, { url: rx }];
  }
  return filter;
}

/**
 * The access boundary for every :id route: an id alone is not permission to touch a
 * document. Written once rather than at ten call sites — the one that forgot the
 * `userId` would hand another account's site to whoever guessed its id.
 */
const ownedSite = (req: AuthedRequest) => ({ _id: req.params['id']!, userId: req.userId });

/** Same for the eight routes that answered a miss with the same sentence. */
function found<T>(doc: T | null): T {
  if (!doc) throw new AppError(404, 'Website not found');
  return doc;
}

function parseDevice(raw: unknown): 'mobile' | 'desktop' | undefined {
  return raw === 'mobile' || raw === 'desktop' ? raw : undefined;
}

// GET /api/websites?q=&page=&limit=
// Without any of those params this returns the plain array it always has, so the
// sidebar, compare picker and automation page keep working untouched.
websiteRouter.get('/websites', asyncHandler<AuthedRequest>(async (req, res) => {
  const { q, page: rawPage, limit: rawLimit } = req.query as Record<string, string | undefined>;
  const filter = ownedFilter(req.userId, q);

  const paginated = rawPage !== undefined || rawLimit !== undefined || q !== undefined;
  const limit = Math.min(
    Math.max(parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  // No database is not a failed request: there is provably nothing stored. Answering with
  // the empty shape leaves the page on "no websites yet" — the storage header set in
  // app.ts is what tells the user why — instead of "the server did not respond".
  if (!isDbReady()) {
    const emptyPage: Paginated<IWebsite> = { items: [], total: 0, page: 1, limit, totalPages: 1 };
    res.json(paginated ? emptyPage : []);
    return;
  }

  if (!paginated) {
    res.json(await Website.find(filter).sort({ createdAt: -1 }));
    return;
  }

  const requested = Math.max(parseInt(rawPage ?? '1', 10) || 1, 1);

  // Count first so an out-of-range page is clamped before the skip is computed —
  // otherwise the response reports the last page but returns an empty list.
  const total      = await Website.countDocuments(filter);
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const page       = Math.min(requested, totalPages);

  const items = await Website.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const body: Paginated<IWebsite> = { items, total, page, limit, totalPages };
  res.json(body);
}));

// GET /api/websites/summary — account-wide headline numbers.
// Deliberately ignores the list's search term so the strip stays put while the
// user types and does not vanish when a filter matches nothing.
websiteRouter.get('/websites/summary', asyncHandler<AuthedRequest>(async (req, res) => {
  const empty: WebsiteSummary = { total: 0, audited: 0, avgScore: 0, needsAttention: 0 };
  if (!isDbReady()) { res.json(empty); return; }

  const sites = await Website.find(ownedFilter(req.userId)).select('url').lean();
  if (!sites.length) { res.json(empty); return; }

  // Shared with GET /api/overview: a site's score is the mean of all its successful
  // audits, matched by host because audits are recorded per route. Two copies of that
  // definition is how the strip and the detail page came to disagree before.
  const scores = [...(await computeSiteScores(req.userId, sites)).values()].map(s => s.avg);

  const summary: WebsiteSummary = {
    total:          sites.length,
    audited:        scores.length,
    avgScore:       meanRounded(scores) ?? 0,
    needsAttention: scores.filter(s => s < SCORE_BANDS.needsImprovement).length,
  };
  res.json(summary);
}));

// POST /api/websites
websiteRouter.post('/websites', asyncHandler<AuthedRequest>(async (req, res) => {
  const { url, name } = req.body as { url: string; name?: string };
  if (!url) throw new AppError(400, 'url is required');

  const normalized = normalizeSiteUrl(url);
  const website = await Website.findOneAndUpdate(
    { userId: req.userId, url: normalized },
    { url: normalized, name: name ?? '' },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  res.status(201).json(website);
}));

// PATCH /api/websites/:id/session — save extracted session data to the website doc
websiteRouter.patch('/websites/:id/session', asyncHandler<AuthedRequest>(async (req, res) => {
  const { cookies = [], localStorage: ls = {} } = req.body as {
    cookies?: unknown[];
    localStorage?: Record<string, string>;
  };

  const website = await Website.findOneAndUpdate(
    ownedSite(req),
    {
      session: { cookies, localStorage: ls, capturedAt: new Date() },
      // Capturing a session is the answer to the login-wall warning, so clear it now
      // rather than making the user re-audit just to dismiss it. A later audit that
      // still lands on the login screen sets it again — that is the expiry signal.
      requiresLogin: null,
    },
    { returnDocument: 'after' },
  );
  res.json(found(website));
}));

// PATCH /api/websites/:id/automation — update automation settings
websiteRouter.patch('/websites/:id/automation', asyncHandler<AuthedRequest>(async (req, res) => {
  const update  = parseAutomationUpdate(req.body);
  const website = await Website.findOneAndUpdate(ownedSite(req), update, { returnDocument: 'after' });
  res.json(found(website));
}));

// GET /api/websites/:id/rum — field data from the site's own visitors.
// Complements the lab audit and CrUX: this is your traffic, every browser, and the only
// view that can see pages behind a login.
websiteRouter.get('/websites/:id/rum', asyncHandler<AuthedRequest>(async (req, res) => {
  const site = found(await Website.findOne(ownedSite(req)).select('_id rumKey').lean());

  const days   = parseInt(String(req.query['days'] ?? RUM_DAYS.summary), 10) || RUM_DAYS.summary;
  const path   = typeof req.query['path'] === 'string' && req.query['path'] ? String(req.query['path']) : undefined;
  const device = parseDevice(req.query['device']);

  const [summary, paths] = await Promise.all([
    getRumSummary({ websiteId: site._id, days, path, device }),
    getRumPaths({ websiteId: site._id, days, device }),
  ]);

  res.json({ success: true, data: { summary, paths, rumKey: site.rumKey ?? null } });
}));

// GET /api/websites/:id/rum/trend — daily p75 for one metric
websiteRouter.get('/websites/:id/rum/trend', asyncHandler<AuthedRequest>(async (req, res) => {
  const site = found(await Website.findOne(ownedSite(req)).select('_id').lean());

  const raw    = String(req.query['metric'] ?? 'lcp');
  const metric = (RUM_METRIC_KEYS as readonly string[]).includes(raw)
    ? raw as (typeof RUM_METRIC_KEYS)[number]
    : 'lcp';

  const days   = parseInt(String(req.query['days'] ?? RUM_DAYS.trend), 10) || RUM_DAYS.trend;
  const device = parseDevice(req.query['device']);

  res.json({ success: true, data: await getRumTrend({ websiteId: site._id, days, device, metric }) });
}));

// POST /api/websites/:id/rum-key — issue (or rotate) the public key for the RUM snippet.
// Not a secret: it ships in the page source of whatever site embeds the collector. Its
// only job is to say which Website a beacon belongs to, so rotating it simply orphans
// any snippet still carrying the old one.
websiteRouter.post('/websites/:id/rum-key', asyncHandler<AuthedRequest>(async (req, res) => {
  const rumKey  = randomBytes(RUM_KEY_BYTES).toString('base64url');
  const website = await Website.findOneAndUpdate(ownedSite(req), { rumKey }, { returnDocument: 'after' });
  found(website);

  res.json({ success: true, data: { rumKey } });
}));

// GET /api/websites/:id/alerts — what was sent, when, and whether it landed.
// Delivery is fire-and-forget, so without this "I never got an alert" is undebuggable.
websiteRouter.get('/websites/:id/alerts', asyncHandler<AuthedRequest>(async (req, res) => {
  const site = found(await Website.findOne(ownedSite(req)).select('_id').lean());

  const limit = Math.min(
    Math.max(parseInt(String(req.query['limit'] ?? ALERTS_LIMIT.default), 10) || ALERTS_LIMIT.default, 1),
    ALERTS_LIMIT.max,
  );
  const alerts = await AlertLog.find({ websiteId: site._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({ success: true, data: alerts });
}));

// PATCH /api/websites/:id/budgets — set or clear performance budgets
websiteRouter.patch('/websites/:id/budgets', asyncHandler<AuthedRequest>(async (req, res) => {
  const parsed = parseBudgets(req.body);
  // No thresholds and no channels at all clears budgets, and any recorded breach with them.
  const update = parsed.budgets === null ? { budgets: null, lastBudgetBreach: null } : parsed;

  const website = await Website.findOneAndUpdate(ownedSite(req), update, { returnDocument: 'after' });
  res.json(found(website));
}));

// POST /api/websites/:id/automation/run — manual trigger for a single website
websiteRouter.post('/websites/:id/automation/run', asyncHandler<AuthedRequest>(async (req, res) => {
  found(await Website.findOne(ownedSite(req)).lean());

  // Fire and forget — respond immediately, the audit runs in the background.
  NightlyAuditService.runForWebsite(String(req.params['id']), req.userId).catch((err: unknown) => {
    console.error('[ManualAudit] Failed:', (err as Error).message);
  });

  res.json({ ok: true, message: 'Audit started in background' });
}));

// DELETE /api/websites/:id
// Silent on a miss by design: the caller wanted the site gone, and it is.
websiteRouter.delete('/websites/:id', asyncHandler<AuthedRequest>(async (req, res) => {
  await Website.deleteOne(ownedSite(req));
  res.json({ ok: true });
}));
