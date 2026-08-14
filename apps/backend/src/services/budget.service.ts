import { fmtMs, fmtCls, hasResult, type BudgetFailure, type AnalysisResult } from '@perfscope/shared';
import { Website, type IWebsite } from '../models/Website.model.js';
import { dispatchAlert } from './alerts.service.js';
import type { OwningSite } from './websiteLookup.js';

function collectFailures(result: AnalysisResult, budgets: NonNullable<IWebsite['budgets']>): BudgetFailure[] {
  const failures: BudgetFailure[] = [];
  const { performance } = result.scores;
  const { lcp, tbt, cls } = result.metrics;

  // performance is a floor; the metrics are ceilings
  if (budgets.performance != null && performance < budgets.performance) {
    failures.push({ metric: 'performance', value: performance, budget: budgets.performance });
  }
  if (budgets.lcp != null && lcp > budgets.lcp) failures.push({ metric: 'lcp', value: lcp, budget: budgets.lcp });
  if (budgets.tbt != null && tbt > budgets.tbt) failures.push({ metric: 'tbt', value: tbt, budget: budgets.tbt });
  if (budgets.cls != null && cls > budgets.cls) failures.push({ metric: 'cls', value: cls, budget: budgets.cls });
  return failures;
}

function describeFailure(f: BudgetFailure): string {
  switch (f.metric) {
    case 'performance': return `performance score ${f.value} (budget ≥ ${f.budget})`;
    case 'cls':         return `CLS ${fmtCls(f.value)} (budget ≤ ${fmtCls(f.budget)})`;
    default:            return `${f.metric.toUpperCase()} ${fmtMs(f.value)} (budget ≤ ${fmtMs(f.budget)})`;
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
    if (site.lastBudgetBreach && site.lastBudgetBreach.url === result.url) {
      site.lastBudgetBreach = null;
      await site.save();
    }
    // Close the incident even when no breach was recorded on this document — the log,
    // not the Website, is the source of truth for whether anyone was told.
    await dispatchAlert(site, {
      kind:   'budget recovered',
      event:  'budget.recovered',
      status: 'recovered',
      url:    result.url,
      formFactor: result.formFactor ?? null,
      metrics: [],
      lines:  ['Back within budget on every threshold.'],
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
    kind:   'budget breach',
    event:  'budget.breach',
    status: 'firing',
    url:    breach.url,
    formFactor: breach.formFactor,
    metrics: failures.map(f => f.metric),
    lines:  failures.map(describeFailure),
    analysisId: breach.analysisId,
    payload: { analysisId: breach.analysisId, failures: breach.failures },
  });
}
