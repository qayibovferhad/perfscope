import type { CoreWebVitals, PerformanceScores } from '../types/analysis.js'

/**
 * A run counts as a regression when a timing metric grows by more than this much
 * against the previous run of the same URL. One number so the evolution chart, the
 * history table and the alerting backend can never disagree about what "regressed" means.
 */
export const REGRESSION_PCT = 15

/** Percentage change from `prev` to `curr`; 0 when there is no baseline to compare against. */
export function deltaPct(curr: number, prev: number): number {
  return !prev ? 0 : ((curr - prev) / prev) * 100
}

/** Timing metrics are "worse when bigger", so a regression is growth beyond the threshold. */
export function isRegression(curr: number, prev: number): boolean {
  return !prev ? false : deltaPct(curr, prev) > REGRESSION_PCT
}

/** Score drop, in points, that is worth alerting about on its own. */
export const SCORE_DROP_POINTS = 10

export type RegressionMetric = 'performance' | 'lcp' | 'tbt' | 'cls'

export interface RegressionFinding {
  metric: RegressionMetric
  /** Value in the run being judged. */
  value: number
  /** Value in the run it is compared against. */
  previous: number
  /** Signed percentage change. Positive means the timing grew; for `performance`, that the score rose. */
  deltaPct: number
}

interface RunSnapshot {
  scores: Pick<PerformanceScores, 'performance'>
  metrics: Pick<CoreWebVitals, 'lcp' | 'tbt' | 'cls'>
}

/**
 * Compare a fresh run against its predecessor.
 *
 * Timings (LCP/TBT/CLS) trip on relative growth, which is what the charts already mark.
 * The performance score is judged on absolute points instead: a percentage rule is
 * unstable at the bottom of the range, where 8 → 10 is a 25% "improvement" that no one
 * would notice, and near the top a 96 → 90 slide would never trip at all.
 */
export function detectRegressions(current: RunSnapshot, previous: RunSnapshot): RegressionFinding[] {
  const findings: RegressionFinding[] = []

  const scoreDrop = previous.scores.performance - current.scores.performance
  if (scoreDrop >= SCORE_DROP_POINTS) {
    findings.push({
      metric:   'performance',
      value:    current.scores.performance,
      previous: previous.scores.performance,
      deltaPct: deltaPct(current.scores.performance, previous.scores.performance),
    })
  }

  for (const metric of ['lcp', 'tbt', 'cls'] as const) {
    const curr = current.metrics[metric]
    const prev = previous.metrics[metric]
    if (isRegression(curr, prev)) {
      findings.push({ metric, value: curr, previous: prev, deltaPct: deltaPct(curr, prev) })
    }
  }

  return findings
}
