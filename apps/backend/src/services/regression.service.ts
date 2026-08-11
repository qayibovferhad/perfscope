import { detectRegressions, hasResult, fmtMs, fmtCls, type RegressionFinding } from '@perfscope/shared';
import { Website } from '../models/Website.model.js';
import { HistoryModel } from '../models/History.model.js';
import { dispatchAlert } from './alerts.service.js';
import { hostOf, hostPrefixRegex } from '../lib/url.js';
import type { AnalysisResult } from '../types/index.js';

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
 * The audit this one should be judged against: the most recent earlier run of the same
 * URL that actually produced numbers. Matched on `url` rather than host, because a
 * regression is only meaningful against the same page — comparing /pricing to / would
 * fire on every alternating audit.
 */
async function findPreviousRun(result: AnalysisResult, userId: string) {
  const docs = await HistoryModel
    .find({ userId, url: result.url, analysisId: { $ne: result.id } })
    .sort({ createdAt: -1 })
    .limit(1)
    .select('analysisId scores metrics createdAt')
    .lean();

  return docs[0] ?? null;
}

export async function checkRegressions(result: AnalysisResult, userId: string | undefined): Promise<void> {
  if (!userId) return;

  // An all-zero failed run carries no signal — it would read as a total collapse.
  if (!hasResult(result)) return;

  const host = hostOf(result.url);
  if (!host) return;

  const site = await Website.findOne({
    userId,
    url: { $regex: hostPrefixRegex(host).source, $options: 'i' },
  });
  // Channels live on `budgets`; with nowhere to send, there is nothing to compute.
  if (!site?.budgets?.webhookUrl && !site?.budgets?.alertEmail) return;

  const previous = await findPreviousRun(result, userId);
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
    analysisId: result.id,
    payload: {
      analysisId:         result.id,
      previousAnalysisId: previous.analysisId,
      findings,
    },
  });
}
