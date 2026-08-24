import {
  VITAL_THRESHOLDS, dayKeysBetween,
  type OverviewCharts, type OverviewRange, type OverviewSiteTrend, type OverviewVitalSplit, type VitalKey,
} from '@perfscope/shared';
import { HistoryModel } from '../models/History.model.js';
import { HAS_RESULT_FILTER } from '../lib/history.js';
import { hostOf } from '../lib/url.js';
import type { PipelineStage } from 'mongoose';

/**
 * The dashboard's three charts, from one pass over the window.
 *
 * A `$facet` rather than three round trips: all three read the same slice of History,
 * and the match stage is the expensive part. Everything is bucketed by UTC day so a run
 * at 23:50 and one at 00:10 land where the calendar says they do rather than where the
 * server's clock drifts to.
 */

/** Kept as the default; the dashboard passes its own window now. */
export const CHART_DAYS = 30;

/** Metrics worth splitting into bands. CLS and TBT are where regressions usually hide. */
const VITAL_KEYS: VitalKey[] = ['lcp', 'tbt', 'cls'];

interface DayCount { _id: string; audits: number }
interface HostDay  { _id: { host: string; day: string }; score: number }
type VitalRow = { _id: null } & Record<string, number>;

/**
 * Band counters built from VITAL_THRESHOLDS rather than retyped numbers — the same
 * reason the tooltips derive their copy from it. A threshold change lands here for free.
 */
function vitalCounters(): Record<string, unknown> {
  const counters: Record<string, unknown> = {};
  for (const key of VITAL_KEYS) {
    const { good, poor } = VITAL_THRESHOLDS[key];
    const value = `$metrics.${key}`;
    counters[`${key}_good`] = { $sum: { $cond: [{ $lte: [value, good] }, 1, 0] } };
    counters[`${key}_poor`] = { $sum: { $cond: [{ $gt:  [value, poor] }, 1, 0] } };
    counters[`${key}_ni`]   = {
      $sum: { $cond: [{ $and: [{ $gt: [value, good] }, { $lte: [value, poor] }] }, 1, 0] },
    };
  }
  return counters;
}

export async function getOverviewCharts(
  userId: string,
  sites: { _id: unknown; url: string; name: string }[],
  /** The window, already resolved — the caller and the client share one definition of it. */
  range: OverviewRange,
  /** Restrict to one site's routes — `normalizedUrl` is stored as `host/path`. */
  hostFilter?: RegExp,
): Promise<OverviewCharts> {
  const days  = dayKeysBetween(range.from, range.to);
  const since = new Date(`${range.from}T00:00:00.000Z`);
  // Closed at the far end too, now that the window can end before today: without this a
  // range picked as "the first week of August" would draw seven ticks and count the whole
  // month into the last of them.
  const until = new Date(`${range.to}T23:59:59.999Z`);

  const [facet] = await HistoryModel.aggregate<{
    activity: DayCount[]; trend: HostDay[]; vitals: VitalRow[];
  }>([
    { $match: { userId, createdAt: { $gte: since, $lte: until }, ...(hostFilter ? { normalizedUrl: hostFilter } : {}), ...HAS_RESULT_FILTER } },
    {
      $facet: {
        activity: [
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, audits: { $sum: 1 } } },
        ],
        trend: [
          {
            $group: {
              // normalizedUrl is stored as "host/path", so the host is its first segment.
              _id: {
                host: { $arrayElemAt: [{ $split: ['$normalizedUrl', '/'] }, 0] },
                day:  { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              },
              score: { $avg: '$scores.performance' },
            },
          },
        ],
        vitals: [{ $group: { _id: null, ...vitalCounters() } }],
      },
    },
  ] as PipelineStage[]);

  const activityByDay = new Map((facet?.activity ?? []).map(r => [r._id, r.audits]));

  const scoreByHostDay = new Map<string, number>();
  for (const row of facet?.trend ?? []) {
    scoreByHostDay.set(`${row._id.host}|${row._id.day}`, Math.round(row.score));
  }

  // One series per tracked site, including sites with no runs in the window: an empty
  // line is information — it says nobody has measured that site in a month.
  const trend: OverviewSiteTrend[] = sites.map((site) => {
    const host = hostOf(site.url);
    return {
      websiteId: String(site._id),
      name:      site.name || host,
      host,
      points: days.map(day => ({ day, score: scoreByHostDay.get(`${host}|${day}`) ?? null })),
    };
  });

  const counts = facet?.vitals?.[0];
  const vitals: OverviewVitalSplit[] = VITAL_KEYS.map(metric => ({
    metric,
    good:             counts?.[`${metric}_good`] ?? 0,
    needsImprovement: counts?.[`${metric}_ni`]   ?? 0,
    poor:             counts?.[`${metric}_poor`] ?? 0,
  }));

  return {
    days: range.days,
    from: range.from,
    to:   range.to,
    trend,
    activity: days.map(day => ({ day, audits: activityByDay.get(day) ?? 0 })),
    vitals,
  };
}
