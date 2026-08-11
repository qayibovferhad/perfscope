import { HistoryModel } from '../models/History.model.js';
import { hasResult } from '@perfscope/shared';
import { Website } from '../models/Website.model.js';
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
const ENTRY_FIELDS = 'analysisId shortId url routePath scores metrics createdAt';

// Re-export shared types so existing imports `from '.../history.service.js'` keep working.
export type { HistoryEntry, ProjectAuditEntry, RouteGroup, ProjectAuditsResult };

function normalizeUrl(url: string): string {
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


function computeTrend(entries: ProjectAuditEntry[]): RouteGroup['trend'] {
  if (entries.length < 2) return 'single';
  const scores = entries.map((e) => e.scores.performance);
  const delta  = scores[scores.length - 1]! - scores[0]!;
  if (delta >= 3) return 'improving';
  if (delta <= -3) return 'regressing';
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
  async save(entry: HistoryEntry, userId?: string, projectId?: string, fullResult?: Record<string, any>): Promise<void> {
    const normalizedUrl = normalizeUrl(entry.url);
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
    });

    const count = await HistoryModel.countDocuments({ normalizedUrl });
    if (count > MAX_PER_URL) {
      const oldest = await HistoryModel
        .find({ normalizedUrl })
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
    let host: string;
    try { host = new URL(url).hostname; } catch { host = normalizeUrl(url).split('/')[0]!; }

    const docs = await HistoryModel
      .find({
        userId,
        normalizedUrl: new RegExp(`^${host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`),
      })
      .select(ENTRY_FIELDS)
      .sort({ createdAt: 1 })
      .lean();

    return docs.map(toEntry).filter(hasResult);
  },

  async getAll(userId: string): Promise<HistoryEntry[]> {
    const docs = await HistoryModel
      .find({ userId })
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
        name: website.name || new URL(website.url).hostname,
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
