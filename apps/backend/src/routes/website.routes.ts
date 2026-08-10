import { Router, type Response } from 'express';
import { HAS_RESULT_FIELDS } from '@perfscope/shared';
import type { QueryFilter } from 'mongoose';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { Website } from '../models/Website.model.js';
import { HistoryModel } from '../models/History.model.js';
import { NightlyAuditService } from '../services/nightlyAudit.service.js';
import { escapeRegex, hostOf, normalizeUrl as normalizeSiteUrl } from '../lib/url.js';

export const websiteRouter: Router = Router();

const MAX_LIMIT = 100;

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

/**
 * A run that failed is still persisted, but with every score and metric at 0.
 * Those must not count as an audited site — mirrors `hasResult` on the client.
 */
const HAS_RESULT = {
  $or: HAS_RESULT_FIELDS.map((field) => ({ [field]: { $gt: 0 } })),
};

// GET /api/websites?q=&page=&limit=
// Without any of those params this returns the plain array it always has, so the
// sidebar, compare picker and automation page keep working untouched.
websiteRouter.get('/websites', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { q, page: rawPage, limit: rawLimit } = req.query as Record<string, string | undefined>;
    const filter = ownedFilter(req.userId, q);

    const paginated = rawPage !== undefined || rawLimit !== undefined || q !== undefined;
    if (!paginated) {
      const websites = await Website.find(filter).sort({ createdAt: -1 });
      return res.json(websites);
    }

    const limit     = Math.min(Math.max(parseInt(rawLimit ?? '12', 10) || 12, 1), MAX_LIMIT);
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
websiteRouter.get('/websites/summary', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const filter = ownedFilter(req.userId);

    const sites = await Website.find(filter).select('url').lean();
    if (!sites.length) {
      return res.json({ total: 0, audited: 0, avgScore: 0, needsAttention: 0 });
    }

    // Audits are recorded per route, so a site's score cannot be found by matching its
    // URL exactly: "https://x.com" never equals the stored "https://x.com/" or
    // "https://x.com/requests". History keeps normalizedUrl as "host/path", so match on
    // the host prefix instead and collect every route belonging to the site.
    const hosts = [...new Set(sites.map((s) => hostOf(s.url)).filter(Boolean))];
    if (!hosts.length) {
      return res.json({ total: sites.length, audited: 0, avgScore: 0, needsAttention: 0 });
    }

    const hostRx = new RegExp(`^(${hosts.map(escapeRegex).join('|')})(/|$)`);
    const entries = await HistoryModel
      .find({ userId: req.userId!, normalizedUrl: hostRx, ...HAS_RESULT } as QueryFilter<Record<string, unknown>>)
      .select('normalizedUrl scores.performance')
      .lean();

    const runsByHost = new Map<string, number[]>();
    for (const e of entries) {
      const host = e.normalizedUrl.split('/')[0]!;
      const runs = runsByHost.get(host) ?? [];
      runs.push(e.scores.performance);
      runsByHost.set(host, runs);
    }

    // A site's score is the mean of all its successful audits — the same definition the
    // project detail page shows as "Avg Score", so the two pages cannot disagree.
    const scores = [...runsByHost.values()].map(
      (runs) => Math.round(runs.reduce((sum, s) => sum + s, 0) / runs.length),
    );
    const needsAttention = scores.filter((s) => s < 50).length;
    const avgScore       = scores.length
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 0;

    return res.json({ total: sites.length, audited: scores.length, avgScore, needsAttention });
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/websites
websiteRouter.post('/websites', requireAuth, async (req: AuthRequest, res: Response) => {
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
websiteRouter.patch('/websites/:id/session', requireAuth, async (req: AuthRequest, res: Response) => {
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
websiteRouter.patch('/websites/:id/automation', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as { enabled?: boolean; routes?: string[]; scheduleTime?: string };

    const update: Record<string, unknown> = {};
    if (typeof body.enabled === 'boolean')  update['automation.enabled']      = body.enabled;
    if (Array.isArray(body.routes))         update['automation.routes']        = body.routes;
    if (typeof body.scheduleTime === 'string' && /^\d{2}:\d{2}$/.test(body.scheduleTime))
                                            update['automation.scheduleTime']  = body.scheduleTime;

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

// POST /api/websites/:id/automation/run — manual trigger for a single website
websiteRouter.post('/websites/:id/automation/run', requireAuth, async (req: AuthRequest, res: Response) => {
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
websiteRouter.delete('/websites/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await Website.deleteOne({ _id: req.params['id']!, userId: req.userId! });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[website]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});
