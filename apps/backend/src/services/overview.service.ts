import {
  SCORE_BANDS, describeBudgetFailure, isOverviewWindow, DEFAULT_OVERVIEW_WINDOW,
  type OverviewData, type OverviewAttention, type OverviewIncident,
} from '@perfscope/shared';
import { meanRounded } from '../lib/stats.js';
import { Website, type IWebsite } from '../models/Website.model.js';
import { HistoryModel } from '../models/History.model.js';
import { AlertLog } from '../models/AlertLog.model.js';
import { RumEvent } from '../models/RumEvent.model.js';
import { HAS_RESULT_FILTER, MANUAL_ONLY_FILTER } from '../lib/history.js';
import { CHART_DAYS, getOverviewCharts } from './overviewCharts.service.js';
import { hostOf, normalizedUrlHostRegex } from '../lib/url.js';
import { Types, type QueryFilter } from 'mongoose';

/**
 * Everything the dashboard needs, in one pass over the account.
 *
 * The score computation lives here rather than in the route because two pages now show
 * "a site's average" — the websites summary strip and the dashboard — and two
 * independent copies of that definition is exactly how they came to disagree before.
 */

/** Audits older than this stop counting toward the "recent activity" number. */
/** Fallback when nothing asks for a window — the dashboard always does. */
const RECENT_DAYS = DEFAULT_OVERVIEW_WINDOW;
/** Rows per list. Enough to see a pattern, few enough to read without scrolling. */
const LIST_LIMIT = 8;
/** Runs scanned to find each listed audit's predecessor. Covers LIST_LIMIT rows comfortably. */
const PRIOR_SCAN = 64;
/** Ceiling on the RUM page-view count — past this the exact number tells the user nothing. */
const RUM_COUNT_CAP = 100_000;

export interface SiteScore {
  /** Mean performance score across every successful audit of any route on this host. */
  avg:  number;
  runs: number;
}

/**
 * Mean performance per site, keyed by host.
 *
 * Audits are recorded per route, so a site's score cannot be found by matching its URL
 * exactly: "https://x.com" never equals the stored "https://x.com/requests". History
 * keeps normalizedUrl as "host/path", so this matches on the host prefix and collects
 * every route belonging to the site.
 */
export async function computeSiteScores(userId: string, sites: { url: string }[]): Promise<Map<string, SiteScore>> {
  const byHost = new Map<string, SiteScore>();

  const hosts = [...new Set(sites.map((s) => hostOf(s.url)).filter(Boolean))];
  if (!hosts.length) return byHost;

  const hostRx = normalizedUrlHostRegex(hosts);
  const entries = await HistoryModel
    .find({ userId, normalizedUrl: hostRx, ...HAS_RESULT_FILTER } as QueryFilter<Record<string, unknown>>)
    .select('normalizedUrl scores.performance')
    .lean();

  const runsByHost = new Map<string, number[]>();
  for (const e of entries) {
    const host = e.normalizedUrl.split('/')[0]!;
    const runs = runsByHost.get(host) ?? [];
    runs.push(e.scores.performance);
    runsByHost.set(host, runs);
  }

  for (const [host, runs] of runsByHost) {
    byHost.set(host, {
      avg:  meanRounded(runs) ?? 0,
      runs: runs.length,
    });
  }
  return byHost;
}

/** Open incidents: the newest alert per site+url+event, kept only while it is still firing. */
async function openIncidents(
  userId: string,
  siteUrlById: Map<string, string>,
  websiteId?: string | undefined,
): Promise<OverviewIncident[]> {
  // A recovery is stored under the *base* event name (see alerts.service `baseEvent`),
  // so a recovered incident's newest entry has status 'recovered' and drops out here.
  // That means there is no incident state to maintain — the log already is the state.
  const rows = await AlertLog.aggregate<{
    _id: { websiteId: unknown; url: string; event: string };
    doc: {
      _id: unknown; websiteId: unknown; url: string; event: string; status: string;
      metrics: string[]; lines: string[]; aiNote?: string;
      delivery: { channel: string; ok: boolean }[]; createdAt: Date;
    };
  }>([
    // AlertLog stores userId as an ObjectId; History stores it as a plain string.
    {
      $match: {
        userId: new Types.ObjectId(userId),
        ...(websiteId ? { websiteId: new Types.ObjectId(websiteId) } : {}),
      },
    },
    { $sort:  { createdAt: -1 } },
    { $group: { _id: { websiteId: '$websiteId', url: '$url', event: '$event' }, doc: { $first: '$$ROOT' } } },
    { $match: { 'doc.status': 'firing' } },
    { $sort:  { 'doc.createdAt': -1 } },
    { $limit: LIST_LIMIT },
  ]);

  return rows.map(({ doc }) => ({
    id:        String(doc._id),
    websiteId: String(doc.websiteId),
    siteUrl:   siteUrlById.get(String(doc.websiteId)) ?? doc.url,
    url:       doc.url,
    event:     doc.event,
    metrics:   doc.metrics ?? [],
    lines:     doc.lines ?? [],
    ...(doc.aiNote ? { aiNote: doc.aiNote } : {}),
    delivery:  (doc.delivery ?? []).map((d) => ({ channel: d.channel as 'webhook' | 'email', ok: d.ok })),
    at:        doc.createdAt.toISOString(),
  }));
}

/** The most actionable problem per site, one reason each. */
function attentionFor(site: IWebsite, score: SiteScore | undefined): OverviewAttention | null {
  const base = {
    websiteId: String(site._id),
    url:       site.url,
    name:      site.name || site.url,
    score:     score?.avg ?? null,
  };

  if (site.lastBudgetBreach) {
    const first = site.lastBudgetBreach.failures[0];
    return {
      ...base,
      reason: 'breach',
      detail: first ? describeBudgetFailure(first) : null,
    };
  }
  if (site.requiresLogin) {
    return { ...base, reason: 'requiresLogin', detail: 'The last run hit a login wall, so its numbers are not the real page.' };
  }
  if (!score) {
    return { ...base, reason: 'neverAudited', detail: 'No successful audit yet.' };
  }
  if (score.avg < SCORE_BANDS.needsImprovement) {
    return { ...base, reason: 'lowScore', detail: `Averaging ${score.avg} over ${score.runs} run${score.runs === 1 ? '' : 's'}.` };
  }
  return null;
}

/**
 * The dashboard for an account with nothing behind it.
 *
 * Returned when the database is unreachable: every panel then renders its own "nothing
 * yet" copy, which is the truth — nothing is stored — whereas failing the request made the
 * whole page report an outage over what is a switched-off optional feature.
 */
export function emptyOverview(): OverviewData {
  return {
    totals:       { sites: 0, audited: 0, avgScore: 0, needsAttention: 0, auditsInWindow: 0 },
    incidents:    [],
    recentAudits: [],
    attention:    [],
    rum:          null,
    charts:       { days: CHART_DAYS, trend: [], activity: [], vitals: [] },
  };
}

/** What the dashboard is asking about: how far back, and whether one site or all of them. */
export interface OverviewScope {
  days?:      number;
  /** A site of this account, or nothing for the whole account. */
  websiteId?: string | undefined;
}

export async function getOverview(userId: string, scope: OverviewScope = {}): Promise<OverviewData> {
  const days = isOverviewWindow(scope.days) ? scope.days : DEFAULT_OVERVIEW_WINDOW;

  const all = await Website.find({ userId }).lean<IWebsite[]>();
  // Narrowed *after* the ownership query, never inside it: a websiteId from the client is
  // an id, not a permission, and the only sites that can be selected are this user's own.
  const sites = scope.websiteId
    ? all.filter((s) => String(s._id) === scope.websiteId)
    : all;
  // A filter naming a site that is not theirs — or one that has since been deleted — has
  // nothing to show, and says so instead of running six queries that cannot match. The
  // first attempt at this filtered on a never-matching regex and learned that a sentinel
  // with a NUL byte in it cannot be serialised into a Mongo query at all.
  if (scope.websiteId && sites.length === 0) return emptyOverview();

  const hosts = sites.map((s) => hostOf(s.url)).filter(Boolean);
  const hostFilter = scope.websiteId && hosts.length ? normalizedUrlHostRegex(hosts) : undefined;
  const siteUrlById = new Map(sites.map((s) => [String(s._id), s.url]));
  const siteIds     = sites.map((s) => s._id);
  const rumInstalled = sites.filter((s) => s.rumKey).length;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [scores, auditsInWindow, recent, incidents, rumRows, charts] = await Promise.all([
    computeSiteScores(userId, sites),
    HistoryModel.countDocuments({ userId, createdAt: { $gte: since }, ...(hostFilter ? { normalizedUrl: hostFilter } : {}), ...HAS_RESULT_FILTER } as QueryFilter<Record<string, unknown>>),
    // Manual only, like the history page: eight rows filled with last night's timetable
    // tell the user nothing they did, and the scheduled page reports those in full.
    HistoryModel
      .find({ userId, ...(hostFilter ? { normalizedUrl: hostFilter } : {}), ...HAS_RESULT_FILTER, ...MANUAL_ONLY_FILTER } as QueryFilter<Record<string, unknown>>)
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .select('url normalizedUrl routePath scores.performance createdAt')
      .lean(),
    openIncidents(userId, siteUrlById, scope.websiteId),
    rumInstalled && siteIds.length
      ? RumEvent.aggregate<{ _id: unknown; views: number }>([
          { $match: { websiteId: { $in: siteIds }, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
          { $group: { _id: '$websiteId', views: { $sum: 1 } } },
          { $limit: 200 },
        ])
      : Promise.resolve([]),
    getOverviewCharts(userId, sites, days, hostFilter),
  ]);

  // Each listed run is compared with the run immediately before *it*, not with one
  // baseline per URL — six runs of the same page each have their own predecessor, and
  // measuring them all against the same one turns a flat history into a fake trend.
  // One query for the whole page rather than one per row.
  const urls = [...new Set(recent.map((r) => r.normalizedUrl))];
  const priorById = new Map<string, number>();
  if (urls.length) {
    const scanned = await HistoryModel
      .find({ userId, normalizedUrl: { $in: urls }, ...HAS_RESULT_FILTER } as QueryFilter<Record<string, unknown>>)
      .sort({ createdAt: -1 })
      .limit(PRIOR_SCAN)
      .select('normalizedUrl scores.performance createdAt')
      .lean();

    const byUrl = new Map<string, typeof scanned>();
    for (const row of scanned) {
      const list = byUrl.get(row.normalizedUrl) ?? [];
      list.push(row);
      byUrl.set(row.normalizedUrl, list);
    }
    // Already newest-first, so a row's predecessor is simply the next one along. The
    // oldest row in the window has none, and reports null rather than a made-up zero.
    for (const list of byUrl.values()) {
      for (let i = 0; i < list.length - 1; i++) {
        priorById.set(String(list[i]!._id), list[i + 1]!.scores.performance);
      }
    }
  }

  const scoreList      = [...scores.values()].map((s) => s.avg);
  const needsAttention = scoreList.filter((s) => s < SCORE_BANDS.needsImprovement).length;

  const attention = sites
    .map((site) => attentionFor(site, scores.get(hostOf(site.url))))
    .filter((row): row is OverviewAttention => row !== null)
    .slice(0, LIST_LIMIT);

  const pageViews24h = rumRows.reduce((sum, r) => sum + r.views, 0);

  return {
    totals: {
      sites:    sites.length,
      audited:  scoreList.length,
      avgScore: meanRounded(scoreList) ?? 0,
      needsAttention,
      auditsInWindow,
    },
    incidents,
    recentAudits: recent.map((r) => {
      const prior = priorById.get(String(r._id));
      return {
        id:         String(r._id),
        url:        r.url,
        score:      r.scores.performance,
        delta:      prior === undefined ? null : r.scores.performance - prior,
        routePath:  r.routePath || '/',
        at:         r.createdAt.toISOString(),
      };
    }),
    attention,
    rum: rumInstalled
      ? {
          pageViews24h:   Math.min(pageViews24h, RUM_COUNT_CAP),
          sitesReporting: rumRows.length,
          sitesInstalled: rumInstalled,
        }
      : null,
    charts,
  };
}
