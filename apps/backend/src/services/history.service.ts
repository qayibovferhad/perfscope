import { HistoryModel } from '../models/History.model.js';
import { MANUAL_ONLY_FILTER, SCHEDULED_ONLY_FILTER } from '../lib/history.js';
import { hasResult, scoreVerdict } from '@perfscope/shared';
import { Website } from '../models/Website.model.js';
import { hostOf, normalizedUrlHostRegex } from '../lib/url.js';
import type { AuditSource, ScheduledSiteGroup, ScheduledRouteGroup } from '@perfscope/shared';
import type {
  HistoryEntry,
  ProjectAuditEntry,
  RouteGroup,
  ProjectAuditsResult,
} from '@perfscope/shared';

const MAX_PER_URL = 10;

/**
 * Exactly the fields `toEntry` and `hasResult` read.
 *
 * Without it these queries load `fullResult` — an entire Lighthouse report per document,
 * stored as Mixed — out of Mongo and then throw it away. The listing endpoints answer with
 * a few hundred bytes per audit, so the cost is invisible in the response and grows with
 * the history: measured at 223 ms for 28 audits against 5 ms for the website list, and it
 * scales linearly. `routePath` is here for the project grouping, which shares this shape.
 */
const ENTRY_FIELDS = 'analysisId shortId url routePath scores metrics createdAt source';

// Re-export shared types so existing imports `from '.../history.service.js'` keep working.
export type { HistoryEntry, ProjectAuditEntry, RouteGroup, ProjectAuditsResult };

/**
 * The scheme-less `host/path` key audits are deduped and pruned by. Named for what it is:
 * lib/url.ts also has a `normalizeUrl`, which does the opposite job (prepends a scheme),
 * and the two sharing a name is how one nearly got swapped for the other.
 */
function auditKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

function extractRoutePath(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return '/';
  }
}


/**
 * Where a route's score ended up against where it started.
 *
 * The same points threshold the history table and the alerts use: three points was inside
 * the spread between two runs of an unchanged page, so most routes were labelled improving
 * or regressing at random.
 */
function computeTrend(entries: ProjectAuditEntry[]): RouteGroup['trend'] {
  if (entries.length < 2) return 'single';
  const scores = entries.map((e) => e.scores.performance);
  const verdict = scoreVerdict(scores[scores.length - 1]!, scores[0]!);
  if (verdict === 'improved')  return 'improving';
  if (verdict === 'regressed') return 'regressing';
  return 'stable';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEntry(d: any): HistoryEntry {
  return {
    id:        d.analysisId,
    shortId:   d.shortId,
    url:       d.url,
    timestamp: (d.createdAt as Date).toISOString(),
    scores:    d.scores,
    metrics:   d.metrics,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProjectEntry(d: any): ProjectAuditEntry {
  return {
    ...toEntry(d),
    routePath: (d.routePath as string | undefined) ?? extractRoutePath(d.url as string),
  };
}

export const HistoryService = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async save(
    entry: HistoryEntry,
    userId?: string,
    projectId?: string,
    fullResult?: Record<string, any>,
    source: AuditSource = 'manual',
  ): Promise<void> {
    const normalizedUrl = auditKey(entry.url);
    const routePath     = extractRoutePath(entry.url);

    await HistoryModel.create({
      analysisId:    entry.id,
      shortId:       entry.shortId,
      url:           entry.url,
      normalizedUrl,
      routePath,
      ...(userId     ? { userId }     : {}),
      ...(projectId  ? { projectId }  : {}),
      scores:        entry.scores,
      metrics:       entry.metrics,
      ...(fullResult ? { fullResult } : {}),
      source,
    });

    // Pruned per source, not per URL: a nightly timetable produces runs far faster than a
    // person does, so one shared cap of ten would quietly evict the audits the user ran by
    // hand — the very ones they go looking for.
    const scope = { normalizedUrl, ...(source === 'scheduled' ? SCHEDULED_ONLY_FILTER : MANUAL_ONLY_FILTER) };
    const count = await HistoryModel.countDocuments(scope);
    if (count > MAX_PER_URL) {
      const oldest = await HistoryModel
        .find(scope)
        .sort({ createdAt: 1 })
        .limit(count - MAX_PER_URL)
        .select('_id');
      await HistoryModel.deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
    }
  },

  /**
   * Every audit belonging to the site, across all of its routes.
   *
   * Matching normalizedUrl exactly would scope this to a single route, so the drill-down
   * showed a different chart from the site card that links to it — one point instead of
   * seven for a site whose audits all live under sub-routes. Failed runs are dropped for
   * the same reason: charted, they draw a cliff to zero.
   */
  /** Audits of a host, for one owner. The owner filter is the access boundary:
   *  a URL is trivially guessable, so an unscoped lookup exposes one account's
   *  audit history to anyone who can name the site. */
  async get(url: string, userId: string): Promise<HistoryEntry[]> {
    const host = hostOf(url) || auditKey(url).split('/')[0]!;

    const docs = await HistoryModel
      .find({
        userId,
        normalizedUrl: normalizedUrlHostRegex(host),
        // The audit history is a record of what the user did; the timetable's runs have
        // their own page, and there are far more of them.
        ...MANUAL_ONLY_FILTER,
      })
      .select(ENTRY_FIELDS)
      .sort({ createdAt: 1 })
      .lean();

    return docs.map(toEntry).filter(hasResult);
  },

  /**
   * Everything the timetable produced, grouped the way it was ordered: by site, then by
   * the route each run measured.
   *
   * Flat, these read as noise — the same handful of URLs over and over, one line per
   * night. Grouped, the page answers the question the schedule was set up to ask: what has
   * each route been doing since I stopped watching it.
   */
  async getScheduled(userId: string): Promise<ScheduledSiteGroup[]> {
    const [docs, sites] = await Promise.all([
      HistoryModel
        .find({ userId, ...SCHEDULED_ONLY_FILTER })
        .select(ENTRY_FIELDS + ' projectId')
        .sort({ createdAt: -1 })
        .lean(),
      Website.find({ userId }).select('url name').lean(),
    ]);

    const siteById = new Map(sites.map(site => [String(site._id), site]));

    // Keyed by projectId, falling back to the host: runs recorded before a site was
    // adopted into a project still belong on its card rather than in a nameless group.
    const groups = new Map<string, { site: { url: string; name: string }; routes: Map<string, ProjectAuditEntry[]> }>();

    for (const doc of docs) {
      const projectId = (doc as { projectId?: string }).projectId ?? '';
      const site      = siteById.get(projectId);
      const key       = projectId || hostOf(doc.url);
      if (!key) continue;

      const group = groups.get(key) ?? {
        site: {
          url:  site?.url  ?? `https://${hostOf(doc.url)}`,
          name: site?.name || site?.url || hostOf(doc.url),
        },
        routes: new Map<string, ProjectAuditEntry[]>(),
      };

      const entry = toProjectEntry(doc);
      const list  = group.routes.get(entry.routePath) ?? [];
      list.push(entry);
      group.routes.set(entry.routePath, list);
      groups.set(key, group);
    }

    return [...groups.entries()]
      .map(([websiteId, group]): ScheduledSiteGroup => {
        const routes: ScheduledRouteGroup[] = [...group.routes.entries()]
          .map(([routePath, entries]) => ({ routePath, entries }))
          .sort((a, b) => a.routePath.localeCompare(b.routePath));

        const runs      = routes.reduce((sum, route) => sum + route.entries.length, 0);
        // Every list above is newest-first, so the first entry of each route is its latest.
        const lastRunAt = routes
          .map(route => route.entries[0]?.timestamp ?? '')
          .sort()
          .at(-1) ?? '';

        return { websiteId, name: group.site.name, url: group.site.url, lastRunAt, runs, routes };
      })
      .sort((a, b) => b.lastRunAt.localeCompare(a.lastRunAt));
  },

  async getAll(userId: string): Promise<HistoryEntry[]> {
    const docs = await HistoryModel
      .find({ userId, ...MANUAL_ONLY_FILTER })
      .select(ENTRY_FIELDS)
      .sort({ createdAt: -1 })
      .lean();
    // Failed 0-score runs are excluded here like everywhere else — the websites
    // overview and history page derive averages from this list.
    return docs.map(toEntry).filter(hasResult);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getById(analysisId: string, userId: string): Promise<Record<string, any> | null> {
    const doc = await HistoryModel
      .findOne({ analysisId, userId })
      .select('fullResult')
      .lean();
    return (doc?.fullResult as Record<string, any> | undefined) ?? null;
  },

  /** Scoped to the owner, so one user can never delete another's audit. */
  async remove(analysisId: string, userId: string): Promise<boolean> {
    const { deletedCount } = await HistoryModel.deleteOne({ analysisId, userId });
    return deletedCount > 0;
  },

  async getByProject(projectId: string, userId: string): Promise<ProjectAuditsResult | null> {
    const website = await Website.findOne({ _id: projectId, userId }).lean();
    if (!website) return null;

    const docs = await HistoryModel
      .find({ projectId })
      .select(ENTRY_FIELDS)
      .sort({ createdAt: 1 })
      .lean();

    const entries = docs.map(toProjectEntry);

    const byRoute = new Map<string, ProjectAuditEntry[]>();
    for (const e of entries) {
      const arr = byRoute.get(e.routePath) ?? [];
      arr.push(e);
      byRoute.set(e.routePath, arr);
    }

    const groups: RouteGroup[] = [];
    for (const [routePath, routeEntries] of byRoute) {
      const sorted = [...routeEntries].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      // Failed runs stay in `entries` so the table still shows them, but the headline
      // score and the trend arrow are computed from the runs that actually produced one.
      const scored = sorted.filter(hasResult);
      groups.push({
        routePath,
        entries:   sorted,
        trend:     computeTrend(scored),
        lastScore: scored[scored.length - 1]?.scores.performance ?? 0,
      });
    }

    groups.sort((a, b) => a.routePath.localeCompare(b.routePath));

    const allScores    = entries.filter(hasResult).map((e) => e.scores.performance);
    const avgPerformance = allScores.length
      ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
      : 0;

    const lastEntry = entries.length
      ? entries.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b)
      : null;

    return {
      project: {
        id:   projectId,
        name: website.name || hostOf(website.url) || website.url,
        url:  website.url,
      },
      groups,
      stats: {
        totalAudits:    entries.length,
        avgPerformance,
        uniqueRoutes:   groups.length,
        lastAuditAt:    lastEntry?.timestamp ?? null,
      },
    };
  },
};
