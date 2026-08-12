import type { CoreWebVitals, PerformanceScores } from '../types/analysis.js'

/**
 * A timing metric counts as regressed when it grows by more than this much against the
 * previous run of the same URL — *and* clears the absolute floor below. One number so the
 * evolution chart, the history table and the alerting backend can never disagree about
 * what "regressed" means.
 */
export const REGRESSION_PCT = 15

/**
 * Score movement of this many points or fewer is the measurement, not the page.
 *
 * Two runs of an unchanged page routinely land several points apart — the network, the CPU
 * and the ad that loaded this time but not last time all move the number. Calling a swing
 * that small "improved" or "regressed" teaches the user to ignore the label, which costs
 * them the runs where it means something. A verdict needs more than this many points.
 */
export const SCORE_NOISE_POINTS = 10

export type RegressionTiming = 'lcp' | 'tbt' | 'cls'

/**
 * The smallest move worth judging, in each metric's own unit (ms, ms, unitless).
 *
 * A percentage on its own screams loudest where it matters least: a page with 30 ms of
 * total blocking time that measures 40 ms on the next run has "regressed by 33%" and
 * nobody could tell the difference. Below these, the change is under the noise the metric
 * carries anyway, whatever the percentage says.
 */
export const METRIC_NOISE: Record<RegressionTiming, number> = {
  lcp: 100,
  tbt: 50,
  cls: 0.02,
}

/** Percentage change from `prev` to `curr`; 0 when there is no baseline to compare against. */
export function deltaPct(curr: number, prev: number): number {
  return !prev ? 0 : ((curr - prev) / prev) * 100
}

/** Timing metrics are "worse when bigger", so a regression is growth past both thresholds. */
export function isRegression(metric: RegressionTiming, curr: number, prev: number): boolean {
  if (!prev) return false
  if (curr - prev < METRIC_NOISE[metric]) return false
  return deltaPct(curr, prev) > REGRESSION_PCT
}

export type ScoreVerdict = 'improved' | 'regressed' | 'stable'

/**
 * What a performance score did between two runs.
 *
 * Points rather than percent: a percentage rule is unstable at the bottom of the range,
 * where 8 → 10 is a 25% "improvement" that no one would notice, and near the top a 96 → 90
 * slide would never trip at all.
 */
export function scoreVerdict(curr: number, prev: number): ScoreVerdict {
  const delta = curr - prev
  if (delta > SCORE_NOISE_POINTS) return 'improved'
  if (delta < -SCORE_NOISE_POINTS) return 'regressed'
  return 'stable'
}

export interface RegressionFinding {
  metric: RegressionMetric
  /** Value in the run being judged. */
  value: number
  /** Value in the run it is compared against. */
  previous: number
  /** Signed percentage change. Positive means the timing grew; for `performance`, that the score rose. */
  deltaPct: number
}

export type RegressionMetric = 'performance' | RegressionTiming

interface RunSnapshot {
  scores: Pick<PerformanceScores, 'performance'>
  metrics: Pick<CoreWebVitals, 'lcp' | 'tbt' | 'cls'>
}

/**
 * Compare a fresh run against its predecessor.
 *
 * Shared with the history table so an audit the user is told regressed is the same audit
 * that raised the alert — the two drifting apart is worse than either threshold being
 * slightly off.
 */
export function detectRegressions(current: RunSnapshot, previous: RunSnapshot): RegressionFinding[] {
  const findings: RegressionFinding[] = []

  if (scoreVerdict(current.scores.performance, previous.scores.performance) === 'regressed') {
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
    if (isRegression(metric, curr, prev)) {
      findings.push({ metric, value: curr, previous: prev, deltaPct: deltaPct(curr, prev) })
    }
  }

  return findings
}
