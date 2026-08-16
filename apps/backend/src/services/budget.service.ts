import { fmtMs, fmtCls, hasResult, collectTargetFailures, type BudgetFailure, type AnalysisResult } from '@perfscope/shared';
import type { IWebsite } from '../models/Website.model.js';
import { dispatchAlert } from './alerts.service.js';
import type { OwningSite } from './websiteLookup.js';

/**
 * Which targets this result misses.
 *
 * Delegates to the shared definition so the breach check, the advisor's plan and the
 * progress bars in the UI cannot disagree about which way a metric compares — this used to
 * be its own copy of the floor/ceiling rules, and the CLI has a third.
 */
function collectFailures(result: AnalysisResult, budgets: NonNullable<IWebsite['budgets']>): BudgetFailure[] {
  return collectTargetFailures(result.scores, result.metrics, budgets);
}

/**
 * One missed target, in the words the user set it in.
 *
 * "Target", not "budget": these are the numbers entered on the site's own Targets tab, and
 * an email about a "budget breach" for a number labelled "target" in the app is the same
 * fact told twice in two vocabularies.
 */
function describeFailure(f: BudgetFailure): string {
  switch (f.metric) {
    case 'performance': return `performance score ${f.value} (target ≥ ${f.budget})`;
    case 'cls':         return `CLS ${fmtCls(f.value)} (target ≤ ${fmtCls(f.budget)})`;
    default:            return `${f.metric.toUpperCase()} ${fmtMs(f.value)} (target ≤ ${fmtMs(f.budget)})`;
  }
}

/**
 * Compare a fresh audit against the owning site's budgets. On breach, record it on
 * the Website (dashboard badge) and POST the payload to the configured webhook.
 * A clean audit of the previously breaching URL clears the recorded breach.
 * Failed-run results (all zeros) never count as breaches — they carry no signal.
 */
export async function checkBudgets(result: AnalysisResult, site: OwningSite): Promise<void> {
  if (!site?.budgets) return;

  // An all-zero failed run must not trip (or clear) budgets.
  if (!hasResult(result)) return;

  const failures = collectFailures(result, site.budgets);

  if (failures.length === 0) {
    // Cleared by any clean audit of this site, not only by one of the exact URL that
    // broke. Recording is already last-wins — a breach on /checkout replaces one on / —
    // so requiring a URL match to clear made the flag write freely and clear almost never:
    // a site whose schedule audits /requests could never clear a breach recorded on its
    // root, and the badge stayed lit forever. (Observed on a real account.)
    //
    // The flag therefore means "the most recent audit of this site was over budget",
    // which is what a site-level badge can honestly claim. Which URL and which thresholds
    // is on the project page, and the alert log keeps the full history either way.
    if (site.lastBudgetBreach) {
      site.lastBudgetBreach = null;
      await site.save();
    }
    // Close the incident even when no breach was recorded on this document — the log,
    // not the Website, is the source of truth for whether anyone was told.
    await dispatchAlert(site, {
      kind:   'back on target',
      // The event *key* stays as it was. It is what `baseEvent()` dedups on and what is
      // already stored against every open incident in AlertLog — renaming it would leave
      // those incidents with no recovery that matches them, and they would never close.
      event:  'budget.recovered',
      status: 'recovered',
      url:    result.url,
      formFactor: result.formFactor ?? null,
      metrics: [],
      lines:  ['Every target met again.'],
      analysisId: result.id,
      payload: { analysisId: result.id },
    });
    return;
  }

  const breach = {
    analysisId: result.id,
    url:        result.url,
    formFactor: result.formFactor ?? null,
    failures,
    at:         new Date(),
  };

  site.lastBudgetBreach = breach;
  await site.save();
  console.warn(`[Budgets] ${result.url} broke ${failures.map(f => f.metric).join(', ')}`);

  // A breach persists across runs, so it is an incident: announced once, then silent
  // until it recovers. Repeating it nightly is how alerting gets muted.
  await dispatchAlert(site, {
    kind:   'target missed',
    event:  'budget.breach',  // stored key — see the note on 'budget.recovered' above
    status: 'firing',
    url:    breach.url,
    formFactor: breach.formFactor,
    metrics: failures.map(f => f.metric),
    lines:  failures.map(describeFailure),
    analysisId: breach.analysisId,
    payload: { analysisId: breach.analysisId, failures: breach.failures },
  });
}
