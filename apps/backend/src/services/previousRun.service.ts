import type { PerformanceScores, CoreWebVitals, AuditFormFactor } from '@perfscope/shared';
import { HistoryModel } from '../models/History.model.js';
import { HAS_RESULT_FILTER } from '../lib/history.js';
import type { ResourceSnapshot } from '../lib/resourceDiff.js';

export interface PreviousRun {
  /** Identifies the run an alert is comparing against, so a webhook payload can link it. */
  analysisId: string;
  scores:     PerformanceScores;
  metrics:    CoreWebVitals;
  /** Date only (YYYY-MM-DD) — what a prompt reads. `atIso` is what the UI formats. */
  at:         string;
  atIso:      string;
  resources:  ResourceSnapshot;
  /** The audits that were failing in that run — the other half of "what changed". */
  audits:     { id: string; title: string }[];
}

/**
 * Runs saved before the form-factor toggle existed carry no `formFactor` at all, and
 * `lighthouse.service.ts` defaults a run without one to `'desktop'` (see `full.formFactor =
 * formFactor ?? 'desktop'`). Treating a missing field as desktop is therefore not a guess:
 * it is the same default the run itself would have been given.
 */
function formFactorFilter(formFactor: AuditFormFactor): Record<string, unknown> {
  return formFactor === 'desktop'
    ? { $or: [{ 'fullResult.formFactor': 'desktop' }, { 'fullResult.formFactor': { $exists: false } }] }
    : { 'fullResult.formFactor': 'mobile' };
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
  /**
   * Compare like with like. A mobile audit next to yesterday's desktop one would report a
   * 30-point "regression" that is only the emulation changing, and every resource would
   * look resized. Omitted (an older caller) means no filtering, which is the behaviour
   * this function had before the deltas needed it.
   */
  formFactor?: AuditFormFactor | undefined,
): Promise<PreviousRun | null> {
  const doc = await HistoryModel
    .findOne({
      userId, url, createdAt: { $lt: before },
      ...HAS_RESULT_FILTER,
      ...(formFactor ? formFactorFilter(formFactor) : {}),
    })
    .sort({ createdAt: -1 })
    .select('analysisId scores metrics createdAt fullResult.resources.requests fullResult.resources.detectedLibraries fullResult.thirdParty fullResult.audits.id fullResult.audits.title')
    .lean()
    .catch(() => null);
  if (!doc) return null;

  const fr = (doc as unknown as {
    fullResult?: {
      resources?: { requests?: { url?: string; transferSize?: number; resourceType?: string }[]; detectedLibraries?: { name?: string }[] };
      thirdParty?: { name?: string; transferSize?: number; mainThreadTime?: number }[];
      audits?: { id?: string; title?: string }[];
    };
  }).fullResult;

  const atIso = new Date(doc.createdAt as unknown as string).toISOString();

  return {
    analysisId: doc.analysisId,
    scores:  doc.scores,
    metrics: doc.metrics,
    at:      atIso.slice(0, 10),
    atIso,
    audits: (fr?.audits ?? [])
      .filter((a): a is { id: string; title?: string } => typeof a.id === 'string')
      .map(a => ({ id: a.id, title: a.title ?? a.id })),
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
