import { fmtMs, fmtCls } from '@perfscope/shared';
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

function describeFailure(f: BudgetFailure): string {
  switch (f.metric) {
    case 'performance': return `performance score ${f.value} (budget ≥ ${f.budget})`;
    case 'cls':         return `CLS ${fmtCls(f.value)} (budget ≤ ${fmtCls(f.budget)})`;
    default:            return `${f.metric.toUpperCase()} ${fmtMs(f.value)} (budget ≤ ${fmtMs(f.budget)})`;
  }
}

/**
 * Slack (and Discord) incoming webhooks reject arbitrary JSON — they need their
 * own envelope. Everything else gets the full structured payload.
 */
export function webhookBody(webhookUrl: string, breach: {
  url: string; formFactor: string | null; failures: BudgetFailure[];
}, site: { url: string; name: string }): unknown {
  const lines = breach.failures.map(f => `• ${describeFailure(f)}`).join('\n');
  const title = `:warning: PerfScope budget breach — ${site.name || site.url}`;
  const text  = `${title}\n${breach.url} (${breach.formFactor ?? 'desktop'})\n${lines}`;

  try {
    const host = new URL(webhookUrl).hostname;
    if (host === 'hooks.slack.com')              return { text };
    if (host.endsWith('discord.com') || host.endsWith('discordapp.com')) return { content: text.replace(':warning:', '⚠️') };
  } catch { /* fall through to the raw payload */ }
  return null;
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
    const body = webhookBody(site.budgets.webhookUrl, breach, site) ?? {
      event:   'budget.breach',
      website: { id: String(site._id), url: site.url, name: site.name },
      ...breach,
      at: breach.at.toISOString(),
    };
    await postWebhook(site.budgets.webhookUrl, body)
      .catch((err: unknown) => console.warn('[Budgets] Webhook failed:', err));
  }
}
