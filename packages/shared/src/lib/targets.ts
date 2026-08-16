import type { CoreWebVitals, PerformanceScores } from '../types/analysis.js'
import type { BudgetFailure } from '../types/website.js'

/**
 * A number you set on a site, and the two things it means.
 *
 * While you are on the wrong side of it, it is a **target**: something to work toward, and
 * what the advisor builds a plan around. Once you are past it, the same number becomes a
 * **guardrail**: falling back across it is a breach, and you get told.
 *
 * One number rather than two because a separate "goal" and "limit" would mean filling in
 * every metric twice and then explaining the difference — and in practice the number you
 * are aiming for is the number you do not want to slip below afterwards.
 */
export type TargetMetric = 'performance' | 'lcp' | 'tbt' | 'cls' | 'inp'

/** Thresholds only. Alert channels live beside these but are not part of the goal. */
export type Targets = Partial<Record<TargetMetric, number | null>>

/**
 * Which direction is good.
 *
 * `performance` is a score out of 100, so higher is better and the number is a floor.
 * Everything else is a duration or a shift amount, so lower is better and it is a ceiling.
 * Getting this backwards silently inverts every verdict, which is why it lives in one map.
 */
export const TARGET_DIRECTION: Record<TargetMetric, 'floor' | 'ceiling'> = {
  performance: 'floor',
  lcp:         'ceiling',
  tbt:         'ceiling',
  cls:         'ceiling',
  inp:         'ceiling',
}

export interface TargetProgress {
  metric: TargetMetric
  /** Where the page is now. */
  value:  number
  target: number
  /** True once the page is on the good side of the number. */
  met:    boolean
  /**
   * How far there is still to go, in the metric's own unit. Zero once met.
   *
   * Signed the way a person would say it: "29 points short", "1.3s too slow" — always a
   * positive distance to cover, never a negative score.
   */
  gap:    number
  /**
   * How far along, 0–1, for a progress bar.
   *
   * Measured from a sensible starting line rather than from zero: a page at 61 against a
   * target of 90 has done most of the work, and a bar that reads 61/90 would say so, while
   * one measured from 0 would make every failing page look nearly finished.
   */
  ratio:  number
}

/** The current value of a metric, from a result's scores or its vitals. */
export function readTargetValue(
  metric: TargetMetric, scores: PerformanceScores, metrics: CoreWebVitals,
): number | null {
  if (metric === 'performance') return scores.performance
  if (metric === 'inp')         return null // INP comes from field data, not a lab run
  return metrics[metric]
}

/** Progress toward one target, or null when it is unset or unmeasured. */
export function targetProgress(
  metric: TargetMetric, value: number | null, target: number | null | undefined,
): TargetProgress | null {
  if (target == null || value == null) return null

  const floor = TARGET_DIRECTION[metric] === 'floor'
  const met   = floor ? value >= target : value <= target
  const gap   = met ? 0 : Math.abs(value - target)

  // For a floor the journey runs 0 → target; for a ceiling it runs from twice the target
  // (a fair "quite bad" starting line) down to it. Both clamp to 0–1.
  const ratio = met
    ? 1
    : floor
      ? Math.max(0, Math.min(1, value / target))
      : Math.max(0, Math.min(1, (2 * target - value) / target))

  return { metric, value, target, met, gap, ratio }
}

/**
 * The metrics a lab audit can actually fail on.
 *
 * `inp` is deliberately absent: it comes from real-user field data, so a Lighthouse run
 * has no value to compare and a target on it can never be judged here. Listed rather than
 * derived, so the type of what comes out matches `BudgetFailure` without a cast.
 */
const FAILABLE = ['performance', 'lcp', 'tbt', 'cls'] as const

/**
 * Every target this result misses.
 *
 * The single definition of "over budget", shared by the breach check, the advisor's
 * context and the UI — three places that would otherwise have three chances to disagree
 * about which way `cls` compares.
 */
export function collectTargetFailures(
  scores: PerformanceScores, metrics: CoreWebVitals, targets: Targets,
): BudgetFailure[] {
  const failures: BudgetFailure[] = []

  for (const metric of FAILABLE) {
    const p = targetProgress(metric, readTargetValue(metric, scores, metrics), targets[metric])
    if (p && !p.met) failures.push({ metric, value: p.value, budget: p.target })
  }

  return failures
}
