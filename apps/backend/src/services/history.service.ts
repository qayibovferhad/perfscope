import { HistoryModel } from '../models/History.model.js';
import { Website } from '../models/Website.model.js';
import type {
  HistoryEntry,
  ProjectAuditEntry,
  RouteGroup,
  ProjectAuditsResult,
} from '@perfscope/shared';

const MAX_PER_URL = 10;

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

  async get(url: string): Promise<HistoryEntry[]> {
    const docs = await HistoryModel
      .find({ normalizedUrl: normalizeUrl(url) })
      .sort({ createdAt: 1 })
      .lean();
    return docs.map(toEntry);
  },

  async getAll(userId: string): Promise<HistoryEntry[]> {
    const docs = await HistoryModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map(toEntry);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getById(analysisId: string, userId: string): Promise<Record<string, any> | null> {
    const doc = await HistoryModel
      .findOne({ analysisId, userId })
      .select('fullResult')
      .lean();
    return (doc?.fullResult as Record<string, any> | undefined) ?? null;
  },

  async getByProject(projectId: string, userId: string): Promise<ProjectAuditsResult | null> {
    const website = await Website.findOne({ _id: projectId, userId }).lean();
    if (!website) return null;

    const docs = await HistoryModel
      .find({ projectId })
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
      groups.push({
        routePath,
        entries:   sorted,
        trend:     computeTrend(sorted),
        lastScore: sorted[sorted.length - 1]!.scores.performance,
      });
    }

    groups.sort((a, b) => a.routePath.localeCompare(b.routePath));

    const allScores    = entries.map((e) => e.scores.performance);
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
