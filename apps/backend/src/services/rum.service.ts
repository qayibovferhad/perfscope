import {
  VITAL_THRESHOLDS, RUM_METRIC_KEYS,
  type RumMetricKey, type RumSummary, type RumMetricSummary, type RumPathRow,
  type RumTrend, type RumTrendPoint, type AuditFormFactor,
} from '@perfscope/shared';
import { RumEvent } from '../models/RumEvent.model.js';
import { findWebsiteByHost } from './websiteLookup.js';
import { intParam } from '../lib/params.js';
import { pathOf } from '../lib/url.js';
import type { PipelineStage, Types } from 'mongoose';

/**
 * Turns raw page views into the p75-and-buckets shape Core Web Vitals are read in.
 *
 * p75 is computed by Mongo rather than in Node: a percentile cannot be derived from
 * summaries, so the alternative is pulling every sample over the wire, which stops being
 * viable exactly when the data becomes interesting.
 */

/** Cap on how far back a query may look — the raw events expire after 45 days anyway. */
const MAX_DAYS = 45;
/** Paths returned in the traffic breakdown. */
const TOP_PATHS = 8;

export interface RumQuery {
  websiteId: string | Types.ObjectId;
  days?:     number;
  path?:     string | undefined;
  device?:   AuditFormFactor | undefined;
}

function windowStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function matchStage(q: Required<Pick<RumQuery, 'websiteId'>> & RumQuery, from: Date): PipelineStage.Match {
  const match: Record<string, unknown> = {
    websiteId: q.websiteId,
    createdAt: { $gte: from },
  };
  if (q.path)   match['path']   = q.path;
  if (q.device) match['device'] = q.device;
  return { $match: match };
}

/**
 * Per metric: how many samples carried it, its p75, and the share in each web.dev bucket.
 * Thresholds come from the shared table so field data grades on the same numbers the
 * lab view does.
 */
function metricAccumulators(): Record<string, unknown> {
  const acc: Record<string, unknown> = {};

  for (const key of RUM_METRIC_KEYS) {
    const { good, poor } = VITAL_THRESHOLDS[key];
    const value = `$${key}`;
    const present = { $ne: [value, null] };

    acc[`${key}_samples`] = { $sum: { $cond: [present, 1, 0] } };
    acc[`${key}_p75`] = {
      $percentile: { input: value, p: [0.75], method: 'approximate' },
    };
    acc[`${key}_good`] = {
      $sum: { $cond: [{ $and: [present, { $lte: [value, good] }] }, 1, 0] },
    };
    acc[`${key}_ni`] = {
      $sum: {
        $cond: [{ $and: [present, { $gt: [value, good] }, { $lte: [value, poor] }] }, 1, 0],
      },
    };
    acc[`${key}_poor`] = {
      $sum: { $cond: [{ $and: [present, { $gt: [value, poor] }] }, 1, 0] },
    };
  }

  return acc;
}

/** $percentile answers with an array, one entry per requested percentile — this unwrap
 *  was copied at every read site. Null when the value isn't a finite number. */
function p75Of(raw: unknown): number | null {
  const v = Array.isArray(raw) ? Number(raw[0]) : Number(raw);
  return Number.isFinite(v) ? v : null;
}

/** CLS is a ratio and needs its decimals; the timings are milliseconds. */
function roundMetric(key: RumMetricKey, v: number): number {
  return key === 'cls' ? Math.round(v * 1000) / 1000 : Math.round(v);
}

function readMetric(row: Record<string, unknown>, key: RumMetricKey): RumMetricSummary | null {
  const samples = Number(row[`${key}_samples`] ?? 0);
  if (samples === 0) return null;

  const p75 = p75Of(row[`${key}_p75`]);
  if (p75 === null) return null;

  const good = Number(row[`${key}_good`] ?? 0);
  const ni   = Number(row[`${key}_ni`]   ?? 0);
  const poor = Number(row[`${key}_poor`] ?? 0);

  return {
    p75: roundMetric(key, p75),
    good:             good / samples,
    needsImprovement: ni   / samples,
    poor:             poor / samples,
    samples,
  };
}

export async function getRumSummary(query: RumQuery): Promise<RumSummary> {
  const days = intParam(query.days, { def: 7, max: MAX_DAYS });
  const from = windowStart(days);
  const to   = new Date();

  const rows = await RumEvent.aggregate([
    matchStage(query, from),
    { $group: { _id: null, pageViews: { $sum: 1 }, ...metricAccumulators() } },
  ]);

  const row = (rows[0] ?? {}) as Record<string, unknown>;
  const metrics: Partial<Record<RumMetricKey, RumMetricSummary>> = {};
  for (const key of RUM_METRIC_KEYS) {
    const summary = readMetric(row, key);
    if (summary) metrics[key] = summary;
  }

  return {
    scope:     query.path ? 'path' : 'site',
    path:      query.path ?? null,
    device:    query.device ?? 'all',
    from:      from.toISOString(),
    to:        to.toISOString(),
    pageViews: Number(row['pageViews'] ?? 0),
    metrics,
  };
}

/**
 * The AI layer's entry point: resolve a plain audited URL to the user's own tracked site
 * and its real-visitor data, or `null` when there is nothing to add (no tracked site, or
 * a tracked site with no snippet installed yet / no traffic in the window).
 *
 * Scoped to this exact path first — same "URL beats origin" preference CrUX's own
 * lookup uses — and falls back to the whole site only when the path itself has no
 * samples, rather than silently reporting a site-wide number as if it were page-specific.
 */
export async function getRumSummaryForUrl(
  userId: string, url: string, formFactor?: AuditFormFactor,
): Promise<RumSummary | null> {
  const site = await findWebsiteByHost(userId, url);
  if (!site) return null;

  const path = pathOf(url) || undefined;

  if (path) {
    const scoped = await getRumSummary({ websiteId: site._id, path, device: formFactor, days: 7 });
    if (scoped.pageViews > 0) return scoped;
  }

  const sitewide = await getRumSummary({ websiteId: site._id, device: formFactor, days: 7 });
  return sitewide.pageViews > 0 ? sitewide : null;
}

/** Busiest paths in the window, so the dashboard can point at where the traffic is. */
export async function getRumPaths(query: RumQuery): Promise<RumPathRow[]> {
  const days = intParam(query.days, { def: 7, max: MAX_DAYS });
  const from = windowStart(days);

  const rows = await RumEvent.aggregate([
    matchStage(query, from),
    {
      $group: {
        _id: '$path',
        pageViews: { $sum: 1 },
        lcp: { $percentile: { input: '$lcp', p: [0.75], method: 'approximate' } },
      },
    },
    { $sort: { pageViews: -1 } },
    { $limit: TOP_PATHS },
  ]);

  return rows.map((r: Record<string, unknown>) => {
    const lcp = p75Of(r['lcp']);
    return {
      path:      String(r['_id']),
      pageViews: Number(r['pageViews'] ?? 0),
      lcp:       lcp !== null ? Math.round(lcp) : null,
    };
  });
}

/**
 * Daily p75 for one metric.
 *
 * Days with no traffic are returned with a null p75 rather than omitted — a gap in the
 * chart is information ("nobody visited"), and interpolating across it would invent a
 * measurement that was never taken.
 */
export async function getRumTrend(
  query: RumQuery & { metric: RumMetricKey },
): Promise<RumTrend> {
  const days = intParam(query.days, { def: 30, max: MAX_DAYS });
  const from = windowStart(days);
  const field = `$${query.metric}`;

  const rows = await RumEvent.aggregate([
    matchStage(query, from),
    { $match: { [query.metric]: { $ne: null } } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$createdAt', unit: 'day' } },
        pageViews: { $sum: 1 },
        p75: { $percentile: { input: field, p: [0.75], method: 'approximate' } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDay = new Map<string, RumTrendPoint>();
  for (const row of rows as Array<Record<string, unknown>>) {
    const day = new Date(row['_id'] as Date).toISOString().slice(0, 10);
    const p75 = p75Of(row['p75']);
    byDay.set(day, {
      day,
      p75: p75 !== null ? roundMetric(query.metric, p75) : null,
      pageViews: Number(row['pageViews'] ?? 0),
    });
  }

  // Walk the whole window so the x-axis is continuous even where traffic was not.
  const points: RumTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const day  = date.toISOString().slice(0, 10);
    points.push(byDay.get(day) ?? { day, p75: null, pageViews: 0 });
  }

  return { metric: query.metric, points };
}
