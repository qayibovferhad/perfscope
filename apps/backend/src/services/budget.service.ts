import { Website, type IWebsite } from '../models/Website.model.js';
import { hostOf, hostPrefixRegex } from '../lib/url.js';
import type { AnalysisResult } from '../types/index.js';

interface BudgetFailure {
  metric: 'performance' | 'lcp' | 'tbt' | 'cls';
  value:  number;
  budget: number;
}

const WEBHOOK_TIMEOUT_MS = 5000;

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

async function postWebhook(webhookUrl: string, payload: unknown): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compare a fresh audit against the owning site's budgets. On breach, record it on
 * the Website (dashboard badge) and POST the payload to the configured webhook.
 * A clean audit of the previously breaching URL clears the recorded breach.
 * Failed-run results (all zeros) never count as breaches — they carry no signal.
 */
export async function checkBudgets(result: AnalysisResult, userId: string | undefined): Promise<void> {
  if (!userId) return;

  const host = hostOf(result.url);
  if (!host) return;

  const site = await Website.findOne({
    userId,
    url: { $regex: hostPrefixRegex(host).source, $options: 'i' },
  });
  if (!site?.budgets) return;

  // An all-zero failed run must not trip (or clear) budgets.
  const { performance, accessibility, bestPractices, seo } = result.scores;
  if (!performance && !accessibility && !bestPractices && !seo) return;

  const failures = collectFailures(result, site.budgets);

  if (failures.length === 0) {
    if (site.lastBudgetBreach && site.lastBudgetBreach.url === result.url) {
      site.set('lastBudgetBreach', null);
      await site.save();
    }
    return;
  }

  const breach = {
    analysisId: result.id,
    url:        result.url,
    formFactor: result.formFactor ?? null,
    failures,
    at:         new Date(),
  };

  site.set('lastBudgetBreach', breach);
  await site.save();
  console.warn(`[Budgets] ${result.url} broke ${failures.map(f => f.metric).join(', ')}`);

  if (site.budgets.webhookUrl) {
    await postWebhook(site.budgets.webhookUrl, {
      event:   'budget.breach',
      website: { id: String(site._id), url: site.url, name: site.name },
      ...breach,
      at: breach.at.toISOString(),
    }).catch((err: unknown) => console.warn('[Budgets] Webhook failed:', err));
  }
}
