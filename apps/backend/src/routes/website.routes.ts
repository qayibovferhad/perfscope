import { randomBytes } from 'node:crypto';
import { Router, type Response } from 'express';
import { SCORE_BANDS, isValidTime, MINUTES_PER_DAY, type AutomationScheduleMode } from '@perfscope/shared';
import type { QueryFilter } from 'mongoose';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { Website } from '../models/Website.model.js';
import { AlertLog } from '../models/AlertLog.model.js';
import { RUM_METRIC_KEYS } from '@perfscope/shared';
import { getRumSummary, getRumPaths, getRumTrend } from '../services/rum.service.js';
import { NightlyAuditService } from '../services/nightlyAudit.service.js';
import { escapeRegex, normalizeUrl as normalizeSiteUrl } from '../lib/url.js';
import { computeSiteScores } from '../services/overview.service.js';
import { isDbReady } from '../config/database.js';
import { requireStorageForWrites } from '../middleware/storage.middleware.js';

export const websiteRouter: Router = Router();

// Path-scoped because every router shares the bare `/api` mount in app.ts: an unscoped
// `.use()` would also intercept requests bound for routers mounted after this one.

// Every route here is pure persistence: without a database a write cannot be honoured, and
// saying so beats a 500. Reads answer with their empty shape instead — see below.
websiteRouter.use('/websites', requireStorageForWrites);

// Every route here is per-user data. Router-level so a newly added route cannot be
// forgotten and ship unauthenticated.
websiteRouter.use('/websites', requireAuth);

const MAX_LIMIT = 100;

const SCHEDULE_MODES: AutomationScheduleMode[] = ['single', 'slots', 'spread'];
/** One slot per hour is already a very busy site; past that it is a mistake, not a plan. */
const MAX_SLOTS = 24;

/**
 * Owner scope plus an optional free-text filter over the site's label and URL.
 * `requireAuth` guarantees userId, but its type stays optional on the request.
 */
function ownedFilter(userId: string | undefined, q?: string): QueryFilter<Record<string, unknown>> {
  const filter: QueryFilter<Record<string, unknown>> = { userId };
  const term = q?.trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    filter['$or'] = [{ name: rx }, { url: rx }];
  }
  return filter;
}

// GET /api/websites?q=&page=&limit=
// Without any of those params this returns the plain array it always has, so the
// sidebar, compare picker and automation page keep working untouched.
websiteRouter.get('/websites', async (req: AuthRequest, res: Response) => {
  try {
    const { q, page: rawPage, limit: rawLimit } = req.query as Record<string, string | undefined>;
    const filter = ownedFilter(req.userId, q);

    const paginated = rawPage !== undefined || rawLimit !== undefined || q !== undefined;
    const limit     = Math.min(Math.max(parseInt(rawLimit ?? '12', 10) || 12, 1), MAX_LIMIT);

    // No database is not a failed request: there is provably nothing stored. Answering with
    // the empty shape leaves the page on "no websites yet" — the storage header set in
    // app.ts is what tells the user why — instead of "the server did not respond".
    if (!isDbReady()) {
      return res.json(paginated ? { items: [], total: 0, page: 1, limit, totalPages: 1 } : []);
    }

    if (!paginated) {
      const websites = await Website.find(filter).sort({ createdAt: -1 });
      return res.json(websites);
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

    return res.json({ items, total, page, limit, totalPages });
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/websites/summary — account-wide headline numbers.
// Deliberately ignores the list's search term so the strip stays put while the
// user types and does not vanish when a filter matches nothing.
websiteRouter.get('/websites/summary', async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbReady()) {
      return res.json({ total: 0, audited: 0, avgScore: 0, needsAttention: 0 });
    }
    const sites = await Website.find(ownedFilter(req.userId)).select('url').lean();
    if (!sites.length) {
      return res.json({ total: 0, audited: 0, avgScore: 0, needsAttention: 0 });
    }

    // Shared with GET /api/overview: a site's score is the mean of all its successful
    // audits, matched by host because audits are recorded per route. Two copies of that
    // definition is how the strip and the detail page came to disagree before.
    const scores = [...(await computeSiteScores(req.userId!, sites)).values()].map((s) => s.avg);

    return res.json({
      total:          sites.length,
      audited:        scores.length,
      avgScore:       scores.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : 0,
      needsAttention: scores.filter((s) => s < SCORE_BANDS.needsImprovement).length,
    });
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/websites
websiteRouter.post('/websites', async (req: AuthRequest, res: Response) => {
  try {
    const { url, name } = req.body as { url: string; name?: string };
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });

    const normalized = normalizeSiteUrl(url);
    const website = await Website.findOneAndUpdate(
      { userId: req.userId!, url: normalized },
      { url: normalized, name: name ?? '' },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return res.status(201).json(website);
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/websites/:id/session — save extracted session data to the website doc
websiteRouter.patch('/websites/:id/session', async (req: AuthRequest, res: Response) => {
  try {
    const { cookies = [], localStorage: ls = {} } = req.body as {
      cookies?: unknown[];
      localStorage?: Record<string, string>;
    };

    const website = await Website.findOneAndUpdate(
      { _id: req.params['id']!, userId: req.userId! },
      {
        session: { cookies, localStorage: ls, capturedAt: new Date() },
        // Capturing a session is the answer to the login-wall warning, so clear it now
        // rather than making the user re-audit just to dismiss it. A later audit that
        // still lands on the login screen sets it again — that is the expiry signal.
        requiresLogin: null,
      },
      { returnDocument: 'after' },
    );
    if (!website) return res.status(404).json({ success: false, error: 'Website not found' });

    return res.json(website);
  } catch (err) {
    console.error('[Website session]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/websites/:id/automation — update automation settings (enabled, routes)
websiteRouter.patch('/websites/:id/automation', async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as {
      enabled?:       boolean;
      routes?:        string[];
      scheduleTime?:  string;
      scheduleMode?:  AutomationScheduleMode;
      slots?:         Array<{ time?: string; routes?: string[] }>;
      spreadMinutes?: number;
    };

    const update: Record<string, unknown> = {};
    if (typeof body.enabled === 'boolean')  update['automation.enabled'] = body.enabled;
    if (Array.isArray(body.routes))         update['automation.routes']  = body.routes;

    // Rejected rather than dropped. The old handler ignored a malformed time silently,
    // which is how an automation ends up looking configured and never firing.
    if (body.scheduleTime !== undefined) {
      if (typeof body.scheduleTime !== 'string' || !isValidTime(body.scheduleTime)) {
        return res.status(400).json({ success: false, error: 'scheduleTime must be HH:MM (00:00–23:59)' });
      }
      update['automation.scheduleTime'] = body.scheduleTime;
    }

    if (body.scheduleMode !== undefined) {
      if (!SCHEDULE_MODES.includes(body.scheduleMode)) {
        return res.status(400).json({ success: false, error: `scheduleMode must be one of ${SCHEDULE_MODES.join(', ')}` });
      }
      update['automation.scheduleMode'] = body.scheduleMode;
    }

    if (body.slots !== undefined) {
      if (!Array.isArray(body.slots)) {
        return res.status(400).json({ success: false, error: 'slots must be an array' });
      }
      if (body.slots.length > MAX_SLOTS) {
        return res.status(400).json({ success: false, error: `At most ${MAX_SLOTS} slots` });
      }
      const slots: Array<{ time: string; routes: string[] }> = [];
      for (const slot of body.slots) {
        if (typeof slot?.time !== 'string' || !isValidTime(slot.time)) {
          return res.status(400).json({ success: false, error: `Slot time must be HH:MM (got "${String(slot?.time)}")` });
        }
        const routes = Array.isArray(slot.routes) ? slot.routes.filter(r => typeof r === 'string' && r.length > 0) : [];
        if (routes.length === 0) {
          return res.status(400).json({ success: false, error: `Slot ${slot.time} has no routes` });
        }
        slots.push({ time: slot.time, routes });
      }
      update['automation.slots'] = slots;
    }

    if (body.spreadMinutes !== undefined) {
      const n = Number(body.spreadMinutes);
      if (!Number.isInteger(n) || n < 1 || n > MINUTES_PER_DAY) {
        return res.status(400).json({ success: false, error: `spreadMinutes must be an integer between 1 and ${MINUTES_PER_DAY}` });
      }
      update['automation.spreadMinutes'] = n;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, error: 'Provide enabled or routes to update' });
    }

    const website = await Website.findOneAndUpdate(
      { _id: req.params['id']!, userId: req.userId! },
      update,
      { returnDocument: 'after' },
    );
    if (!website) return res.status(404).json({ success: false, error: 'Website not found' });

    return res.json(website);
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/websites/:id/rum — field data from the site's own visitors.
// Complements the lab audit and CrUX: this is your traffic, every browser, and the only
// view that can see pages behind a login.
websiteRouter.get('/websites/:id/rum', async (req: AuthRequest, res: Response) => {
  try {
    const site = await Website.findOne({ _id: req.params['id']!, userId: req.userId! })
      .select('_id rumKey').lean();
    if (!site) return res.status(404).json({ success: false, error: 'Website not found' });

    const days   = parseInt(String(req.query['days'] ?? '7'), 10) || 7;
    const path   = typeof req.query['path'] === 'string' && req.query['path'] ? String(req.query['path']) : undefined;
    const device = req.query['device'] === 'mobile' || req.query['device'] === 'desktop'
      ? req.query['device'] as 'mobile' | 'desktop'
      : undefined;

    const [summary, paths] = await Promise.all([
      getRumSummary({ websiteId: site._id, days, path, device }),
      getRumPaths({ websiteId: site._id, days, device }),
    ]);

    return res.json({ success: true, data: { summary, paths, rumKey: site.rumKey ?? null } });
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/websites/:id/rum/trend — daily p75 for one metric
websiteRouter.get('/websites/:id/rum/trend', async (req: AuthRequest, res: Response) => {
  try {
    const site = await Website.findOne({ _id: req.params['id']!, userId: req.userId! }).select('_id').lean();
    if (!site) return res.status(404).json({ success: false, error: 'Website not found' });

    const raw = String(req.query['metric'] ?? 'lcp');
    const metric = (RUM_METRIC_KEYS as readonly string[]).includes(raw)
      ? raw as (typeof RUM_METRIC_KEYS)[number]
      : 'lcp';

    const days   = parseInt(String(req.query['days'] ?? '30'), 10) || 30;
    const device = req.query['device'] === 'mobile' || req.query['device'] === 'desktop'
      ? req.query['device'] as 'mobile' | 'desktop'
      : undefined;

    const trend = await getRumTrend({ websiteId: site._id, days, device, metric });
    return res.json({ success: true, data: trend });
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/websites/:id/rum-key — issue (or rotate) the public key for the RUM snippet.
// Not a secret: it ships in the page source of whatever site embeds the collector. Its
// only job is to say which Website a beacon belongs to, so rotating it simply orphans
// any snippet still carrying the old one.
websiteRouter.post('/websites/:id/rum-key', async (req: AuthRequest, res: Response) => {
  try {
    const rumKey = randomBytes(12).toString('base64url');

    const website = await Website.findOneAndUpdate(
      { _id: req.params['id']!, userId: req.userId! },
      { rumKey },
      { returnDocument: 'after' },
    );
    if (!website) return res.status(404).json({ success: false, error: 'Website not found' });

    return res.json({ success: true, data: { rumKey } });
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/websites/:id/alerts — what was sent, when, and whether it landed.
// Delivery is fire-and-forget, so without this "I never got an alert" is undebuggable.
websiteRouter.get('/websites/:id/alerts', async (req: AuthRequest, res: Response) => {
  try {
    const site = await Website.findOne({ _id: req.params['id']!, userId: req.userId! }).select('_id').lean();
    if (!site) return res.status(404).json({ success: false, error: 'Website not found' });

    const limit = Math.min(Math.max(parseInt(String(req.query['limit'] ?? '20'), 10) || 20, 1), 100);
    const alerts = await AlertLog.find({ websiteId: site._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, data: alerts });
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/websites/:id/budgets — set or clear performance budgets
websiteRouter.patch('/websites/:id/budgets', async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as {
      performance?: number | null; lcp?: number | null; tbt?: number | null;
      cls?: number | null; inp?: number | null; webhookUrl?: string | null; alertEmail?: string | null;
    };

    const num = (v: unknown, min: number, max: number): number | null =>
      typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

    let webhookUrl: string | null = null;
    if (typeof body.webhookUrl === 'string' && body.webhookUrl.trim()) {
      try {
        const u = new URL(body.webhookUrl.trim());
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol');
        webhookUrl = u.toString();
      } catch {
        return res.status(400).json({ success: false, error: 'webhookUrl must be a valid http(s) URL' });
      }
    }

    let alertEmail: string | null = null;
    if (typeof body.alertEmail === 'string' && body.alertEmail.trim()) {
      const email = body.alertEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, error: 'alertEmail must be a valid email address' });
      }
      alertEmail = email;
    }

    const budgets = {
      performance: num(body.performance, 1, 100),
      lcp:         num(body.lcp, 100, 60_000),
      tbt:         num(body.tbt, 0,   60_000),
      cls:         num(body.cls, 0.01, 5),
      inp:         num(body.inp, 10, 60_000),
      webhookUrl,
      alertEmail,
    };
    // Channels stand on their own: regression alerts need somewhere to send without any
    // threshold being set, so only a fully blank form clears the record.
    const noThresholds = budgets.performance == null && budgets.lcp == null &&
                         budgets.tbt == null && budgets.cls == null && budgets.inp == null;
    const empty = noThresholds && !webhookUrl && !alertEmail;

    const website = await Website.findOneAndUpdate(
      { _id: req.params['id']!, userId: req.userId! },
      // No thresholds at all clears budgets (and any recorded breach) entirely.
      empty ? { budgets: null, lastBudgetBreach: null } : { budgets },
      { returnDocument: 'after' },
    );
    if (!website) return res.status(404).json({ success: false, error: 'Website not found' });

    return res.json(website);
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/websites/:id/automation/run — manual trigger for a single website
websiteRouter.post('/websites/:id/automation/run', async (req: AuthRequest, res: Response) => {
  try {
    const website = await Website.findOne({ _id: req.params['id']!, userId: req.userId! }).lean();
    if (!website) return res.status(404).json({ success: false, error: 'Website not found' });

    // Fire and forget — respond immediately, audit runs in background.
    NightlyAuditService.runForWebsite(String(req.params['id']), req.userId!).catch((err: unknown) => {
      console.error('[ManualAudit] Failed:', (err as Error).message);
    });

    return res.json({ ok: true, message: 'Audit started in background' });
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/websites/:id
websiteRouter.delete('/websites/:id', async (req: AuthRequest, res: Response) => {
  try {
    await Website.deleteOne({ _id: req.params['id']!, userId: req.userId! });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});
