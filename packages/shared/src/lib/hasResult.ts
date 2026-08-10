import type { PerformanceScores, CoreWebVitals } from '../types/analysis.js'

/** The minimal shape hasResult needs — HistoryEntry and backend docs both satisfy it. */
export interface AuditSnapshot {
  scores:  PerformanceScores
  metrics: CoreWebVitals
}

/**
 * A run that failed (unreachable host, Chrome crash, timeout) is still persisted, but
 * with every score and metric at 0. Such a run carries no signal, so it must stay out of
 * every score-derived stat — otherwise one failure drags a site's average toward zero.
 * It is still listed in audit tables: the user should see that a run happened.
 *
 * Single source of truth for client and backend; Mongo queries build the equivalent
 * filter from HAS_RESULT_FIELDS so the two can never drift.
 */
export function hasResult(entry: AuditSnapshot): boolean {
  const { performance, accessibility, bestPractices, seo } = entry.scores
  if (performance || accessibility || bestPractices || seo) return true

  const { fcp, lcp, tbt, cls, si, tti } = entry.metrics
  return Boolean(fcp || lcp || tbt || cls || si || tti)
}

/** Field paths for a Mongo `$or: [{ field: { $gt: 0 } }]` filter equivalent to hasResult. */
export const HAS_RESULT_FIELDS = [
  'scores.performance',
  'scores.accessibility',
  'scores.bestPractices',
  'scores.seo',
  'metrics.fcp',
  'metrics.lcp',
  'metrics.tbt',
  'metrics.cls',
  'metrics.si',
  'metrics.tti',
] as const
