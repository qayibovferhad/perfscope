import type { PerformanceScores, CoreWebVitals } from '@perfscope/shared';
import { HistoryModel } from '../models/History.model.js';
import { HAS_RESULT_FILTER } from '../lib/history.js';
import type { ResourceSnapshot } from '../lib/resourceDiff.js';

export interface PreviousRun {
  scores:     PerformanceScores;
  metrics:    CoreWebVitals;
  at:         string;
  resources:  ResourceSnapshot;
}

/**
 * The audit immediately before a given point in time, for the same owner and URL — what
 * `analysePage` leads with ("what moved since last run"), and what `diffResources`
 * compares the current run against to name the file responsible for the movement.
 *
 * Selects only the resource fields a diff needs, not the whole `fullResult` — a stored
 * audit also carries the timeline, flame chart and heap trace, and none of that is
 * needed here. `before` rather than "most recent full stop": a reopened old audit needs
 * the run before *it*, not the account's newest run overall (`askAboutAudit` reopens
 * audits from any point in history, not just the latest).
 */
export async function getPreviousRun(
  userId: string, url: string, before: Date,
): Promise<PreviousRun | null> {
  const doc = await HistoryModel
    .findOne({ userId, url, createdAt: { $lt: before }, ...HAS_RESULT_FILTER })
    .sort({ createdAt: -1 })
    .select('scores metrics createdAt fullResult.resources.requests fullResult.resources.detectedLibraries fullResult.thirdParty')
    .lean()
    .catch(() => null);
  if (!doc) return null;

  const fr = (doc as unknown as {
    fullResult?: {
      resources?: { requests?: { url?: string; transferSize?: number; resourceType?: string }[]; detectedLibraries?: { name?: string }[] };
      thirdParty?: { name?: string; transferSize?: number; mainThreadTime?: number }[];
    };
  }).fullResult;

  return {
    scores:  doc.scores  as unknown as PerformanceScores,
    metrics: doc.metrics as unknown as CoreWebVitals,
    at:      new Date(doc.createdAt as unknown as string).toISOString().slice(0, 10),
    resources: {
      requests: (fr?.resources?.requests ?? [])
        .filter((r): r is { url: string; transferSize: number; resourceType: string } => typeof r.url === 'string')
        .map(r => ({ url: r.url, transferSize: r.transferSize ?? 0, resourceType: r.resourceType ?? 'other' })),
      detectedLibraries: (fr?.resources?.detectedLibraries ?? [])
        .filter((l): l is { name: string } => typeof l.name === 'string'),
      thirdParty: (fr?.thirdParty ?? [])
        .filter((t): t is { name: string; transferSize: number; mainThreadTime: number } => typeof t.name === 'string')
        .map(t => ({ name: t.name, transferSize: t.transferSize ?? 0, mainThreadTime: t.mainThreadTime ?? 0 })),
    },
  };
}
