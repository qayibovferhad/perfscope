import { detectRegressions, hasResult, fmtMs, fmtCls, type RegressionFinding, type AnalysisResult } from '@perfscope/shared';
import { dispatchAlert, hasAlertChannel } from './alerts.service.js';
import { getPreviousRun } from './previousRun.service.js';
import { diffResources, resourceDiffHasChanges, formatResourceDiff } from '../lib/resourceDiff.js';
import type { PreviousRun } from './previousRun.service.js';
import type { OwningSite } from './websiteLookup.js';

/**
 * Alerts on a run that got materially worse than the one before it.
 *
 * Budgets answer "is this page fast enough?", which stays silent while a page degrades
 * inside its allowance — a site can slide from 95 to 82 against a budget of 80 and never
 * say a word. This answers the other question: "did something change?"
 */

function describe(f: RegressionFinding): string {
  const pct = `${f.deltaPct > 0 ? '+' : ''}${f.deltaPct.toFixed(1)}%`;

  switch (f.metric) {
    case 'performance':
      return `Performance score ${f.value}, down from ${f.previous} (${pct})`;
    case 'cls':
      return `CLS ${fmtCls(f.value)}, up from ${fmtCls(f.previous)} (${pct})`;
    default:
      return `${f.metric.toUpperCase()} ${fmtMs(f.value)}, up from ${fmtMs(f.previous)} (${pct})`;
  }
}

/**
 * What actually moved, named down to the file.
 *
 * A regression alert used to carry the numbers and nothing else, so the note attached to
 * it could only say what any monitoring tool says. The diff against the run being
 * compared is the difference between "LCP got worse" and "LCP got worse and you shipped
 * a 400KB hero image". Empty when either run predates the stored resource lists, which
 * is exactly when there is nothing honest to say about a cause.
 */
function whatChanged(result: AnalysisResult, previous: PreviousRun): string[] {
  if (!result.resources) return [];

  const diff = diffResources(
    {
      requests: result.resources.requests,
      detectedLibraries: result.resources.detectedLibraries,
      thirdParty: result.thirdParty ?? [],
    },
    previous.resources,
  );
  return resourceDiffHasChanges(diff) ? formatResourceDiff(diff) : [];
}

export async function checkRegressions(
  result: AnalysisResult,
  userId: string | undefined,
  site: OwningSite,
): Promise<void> {
  if (!userId) return;

  // An all-zero failed run carries no signal — it would read as a total collapse.
  if (!hasResult(result)) return;

  // Channels live on `budgets`; with nowhere to send, there is nothing to compute.
  if (!hasAlertChannel(site)) return;

  // The same lookup `analysePage` uses, rather than a second one beside it: it already
  // excludes failed all-zero runs, which the local copy did not — a regression hidden
  // behind a failed run is still a regression, and comparing against zeros hid it.
  const previous = await getPreviousRun(userId, result.url, new Date(result.timestamp));
  if (!previous) return;  // first audit of this URL — nothing to regress against

  const findings = detectRegressions(
    { scores: result.scores, metrics: result.metrics },
    { scores: previous.scores, metrics: previous.metrics },
  );
  if (findings.length === 0) return;

  console.warn(`[Regressions] ${result.url} regressed: ${findings.map(f => f.metric).join(', ')}`);

  // A regression is measured against the run before it, so it cannot stay "true" the way
  // a breach does — a page that stays slow stops regressing. Point-in-time, rate-limited.
  await dispatchAlert(site!, {
    kind:   'regression',
    event:  'audit.regression',
    status: 'event',
    url:    result.url,
    formFactor: result.formFactor ?? null,
    metrics: findings.map(f => f.metric),
    lines:  findings.map(describe),
    evidence: whatChanged(result, previous),
    analysisId: result.id,
    payload: {
      analysisId:         result.id,
      previousAnalysisId: previous.analysisId,
      findings,
    },
  });
}
