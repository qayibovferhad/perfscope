/**
 * One Lighthouse flow step → what the report shows.
 *
 * The whole job here is to keep each mode honest. Lighthouse hands back a full LHR for
 * every step, and most of it is meaningless outside the mode that produced it: a snapshot
 * reports `performance: 0` because it has no timing to score, and a timespan reports no LCP
 * because nothing was loading. Copying the LHR through wholesale would put a confident 0 on
 * screen next to a page nobody measured, which is the failure this product cannot afford.
 *
 * So the mode decides what is read — `FLOW_MODE_CATEGORIES` and `FLOW_MODE_METRICS` in
 * shared, so the client draws exactly what the server stored.
 */
import type { Result as LhrResult } from 'lighthouse';
import {
  FLOW_MODE_CATEGORIES, FLOW_MODE_METRICS,
  type FlowAuditItem, type FlowStepMode, type FlowStepResult,
} from '@perfscope/shared';
import { toScore, buildAuditPlacements } from './lhr-transform.js';

/** Lighthouse audit ids for the metrics a flow reports, per our own metric names. */
const METRIC_AUDIT: Record<string, string> = {
  inp: 'interaction-to-next-paint',
  tbt: 'total-blocking-time',
  cls: 'cumulative-layout-shift',
  lcp: 'largest-contentful-paint',
  fcp: 'first-contentful-paint',
  si:  'speed-index',
  tti: 'interactive',
};

const CATEGORY_KEY: Record<string, string> = {
  performance: 'performance',
  accessibility: 'accessibility',
  bestPractices: 'best-practices',
  seo: 'seo',
};

/**
 * Failing audits, capped.
 *
 * Ten rather than the analyzer's fifteen-per-category: a flow report is several steps on one
 * screen, and the reader is there for the interaction, not for a full accessibility
 * inventory of every intermediate state. The order is the same — worst first.
 */
const AUDITS_PER_STEP = 10;

function failingAudits(lhr: LhrResult): FlowAuditItem[] {
  const placements = buildAuditPlacements(lhr);

  return Object.entries(lhr.audits ?? {})
    .filter(([, audit]) => audit.score !== null && (audit.score ?? 1) < 0.9)
    .sort(([, a], [, b]) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, AUDITS_PER_STEP)
    .map(([id, audit]): FlowAuditItem => ({
      id,
      title: audit.title ?? id,
      score: audit.score ?? null,
      ...(placements.get(id)?.category ? { category: placements.get(id)!.category } : {}),
      ...(audit.displayValue ? { displayValue: audit.displayValue } : {}),
    }));
}

export function buildFlowStepResult(
  step: { lhr: LhrResult; name?: string },
  action?: string,
): FlowStepResult {
  const lhr = step.lhr;
  // `gatherMode` is Lighthouse's own word for which of the three modes produced this LHR.
  const mode = (lhr.gatherMode ?? 'navigation') as FlowStepMode;

  const scores: FlowStepResult['scores'] = {};
  for (const key of FLOW_MODE_CATEGORIES[mode] ?? []) {
    const category = lhr.categories?.[CATEGORY_KEY[key]!];
    // `score` is null for a category with nothing applicable in it — absent, not zero.
    if (category && category.score !== null && category.score !== undefined) {
      scores[key] = toScore(category.score);
    }
  }

  const metrics: FlowStepResult['metrics'] = {};
  for (const key of FLOW_MODE_METRICS[mode] ?? []) {
    const value = lhr.audits?.[METRIC_AUDIT[key]!]?.numericValue;
    if (typeof value === 'number') metrics[key] = value;
  }

  return {
    name: step.name || lhr.finalDisplayedUrl || mode,
    mode,
    scores,
    metrics,
    audits: failingAudits(lhr),
    ...(action ? { action } : {}),
  };
}
