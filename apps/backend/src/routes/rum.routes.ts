import express, { Router, type Request, type Response } from 'express';
import cors from 'cors';
import { RUM_COLLECTOR_JS } from '../services/rumCollector.js';
import { Website } from '../models/Website.model.js';
import { RumEvent } from '../models/RumEvent.model.js';

export const rumRouter: Router = Router();

/**
 * The public half of RUM: the collector any site can embed, and the endpoint it beacons
 * to. Both are deliberately unauthenticated — they run in a visitor's browser on someone
 * else's origin, where there is no session and no secret worth putting in page source.
 * The site key identifies which Website a sample belongs to and nothing more.
 */

/** Ingest and collector are cross-origin by definition; the app's own CORS rule cannot apply. */
const publicCors = cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] });

const MAX_PATH_LEN = 300;
/** Plausibility ceilings — a page view cannot take a day, and outliers skew p75. */
const LIMITS = {
  lcp:  120_000,
  inp:  120_000,
  cls:  100,
  fcp:  120_000,
  ttfb: 120_000,
} as const;

/** Beacons per key per window. Generous for a real site, useless for a flood. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX       = 600;
const rate = new Map<string, { count: number; resetAt: number }>();

function overRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rate.get(key);
  if (!entry || now > entry.resetAt) {
    rate.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

// Keeps the map from growing once a key goes quiet.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rate) if (now > entry.resetAt) rate.delete(key);
}, RATE_WINDOW_MS).unref();

/** Site keys are looked up on every beacon; the mapping changes rarely. */
const KEY_TTL_MS = 5 * 60_000;
const keyCache = new Map<string, { websiteId: string | null; at: number }>();

async function websiteIdForKey(key: string): Promise<string | null> {
  const hit = keyCache.get(key);
  if (hit && Date.now() - hit.at < KEY_TTL_MS) return hit.websiteId;

  const site = await Website.findOne({ rumKey: key }).select('_id').lean();
  const websiteId = site ? String(site._id) : null;
  // Unknown keys are cached too — a misconfigured snippet must not hammer Mongo.
  keyCache.set(key, { websiteId, at: Date.now() });
  return websiteId;
}

/** Only finite, non-negative numbers within a plausible ceiling reach storage. */
function metric(value: unknown, limit: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || value > limit) return null;
  return value;
}

/** Defends the index and the dashboard against a path built from unbounded input. */
function cleanPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const path = raw.split('?')[0]!.split('#')[0]!;
  if (!path.startsWith('/')) return null;
  return path.length > MAX_PATH_LEN ? path.slice(0, MAX_PATH_LEN) : path;
}

// GET /rum.js — the collector. Cacheable: it is the same file for every site, with the
// key supplied by the script tag rather than baked in.
rumRouter.get('/rum.js', publicCors, (_req: Request, res: Response) => {
  res.type('application/javascript');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(RUM_COLLECTOR_JS);
});

rumRouter.options('/api/rum', publicCors);

/**
 * navigator.sendBeacon posts a string as `text/plain`, which express.json() ignores —
 * the body would arrive empty and every beacon would be dropped in silence. Sending
 * `application/json` instead is not an option: it is not a CORS-simple content type, so
 * the browser would demand a preflight, and sendBeacon cannot make one. Parse the text
 * here instead, and keep the request simple.
 */
const beaconBody = express.text({ type: ['text/plain', 'application/json'], limit: '8kb' });

// POST /api/rum — one page view. Answers 204 whatever happens: the browser is on its way
// out and cannot act on an error, and a detailed rejection would only help someone
// probing for valid site keys.
rumRouter.post('/api/rum', publicCors, beaconBody, async (req: Request, res: Response) => {
  res.status(204);

  try {
    const raw = req.body;
    let body: Record<string, unknown>;
    if (typeof raw === 'string') {
      try { body = JSON.parse(raw) as Record<string, unknown>; } catch { return res.end(); }
    } else {
      body = (raw ?? {}) as Record<string, unknown>;
    }
    const key  = typeof body['key'] === 'string' ? body['key'] : null;
    const path = cleanPath(body['path']);
    if (!key || !path) return res.end();

    if (overRateLimit(key)) return res.end();

    const websiteId = await websiteIdForKey(key);
    if (!websiteId) return res.end();

    const device = body['device'] === 'mobile' ? 'mobile' : 'desktop';
    const sample = {
      lcp:  metric(body['lcp'],  LIMITS.lcp),
      inp:  metric(body['inp'],  LIMITS.inp),
      cls:  metric(body['cls'],  LIMITS.cls),
      fcp:  metric(body['fcp'],  LIMITS.fcp),
      ttfb: metric(body['ttfb'], LIMITS.ttfb),
    };

    // A row with nothing measured is noise; the collector already declines to send one,
    // but a hand-rolled POST could.
    if (Object.values(sample).every(v => v === null)) return res.end();

    await RumEvent.create({
      websiteId,
      path,
      device,
      ...sample,
      v: typeof body['v'] === 'number' ? body['v'] : 1,
    });

    return res.end();
  } catch (err) {
    console.warn('[RUM] Ingest failed:', err);
    return res.end();
  }
});
