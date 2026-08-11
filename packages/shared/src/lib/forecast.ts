/**
 * Trend forecasting over an audit history: fit a line, project where a metric
 * lands, and estimate when it will cross a budget.
 *
 * The model is deliberately the simplest one that can be defended: an ordinary
 * least-squares fit of value against *days elapsed*, not against sample index —
 * audits arrive at irregular intervals, and a run-number fit would read a burst
 * of five audits in one afternoon as five days of movement.
 *
 * Pure and deterministic: every date it needs comes out of the samples, so a test
 * fixture always produces the same forecast.
 */

import { VITAL_THRESHOLDS } from './rating.js'

export type ForecastMetric = 'performance' | 'lcp' | 'tbt' | 'cls'

export interface ForecastSample {
  /** ISO timestamp of the audit. */
  at:    string
  value: number
}

export interface MetricForecast {
  metric: ForecastMetric
  /** Latest observed value. */
  current: number
  /** Fitted change per day (negative = value falling). */
  slopePerDay: number
  /** Goodness of fit, 0–1; low values mean the trend is mostly noise. */
  r2: number
  /** Direction in user terms — accounts for "higher is better" on scores. */
  direction: 'improving' | 'worsening' | 'flat'
  /** Days until the fitted line crosses `budget`; null when it never will. */
  daysToBudget: number | null
  /** Derived from r2 and sample count — drives whether the UI shows the projection. */
  confidence: 'low' | 'medium' | 'high'
  sampleCount: number
}

const DAY_MS = 86_400_000

/** Fewer points than this and a line through them is decoration, not a trend. */
const MIN_SAMPLES = 3

/** Beyond ten years a "prediction" is arithmetic, not information. */
const MAX_DAYS_TO_BUDGET = 3650

/** The projection horizon the "flat" test is judged over. */
const FLAT_HORIZON_DAYS = 30

/**
 * A trend counts as flat when the line moves less than 2% of the metric's natural
 * scale across {@link FLAT_HORIZON_DAYS}. The scale is the metric's "good" threshold
 * (the number a user actually reasons about), so the rule reads as:
 *   performance  <  2 points / 30 days
 *   lcp          < 50 ms     / 30 days
 *   tbt          <  4 ms     / 30 days
 *   cls          <  0.002    / 30 days
 */
const FLAT_FRACTION_OF_SCALE = 0.02

const METRIC_SCALE: Record<ForecastMetric, number> = {
  performance: 100, // a score is 0–100, so the whole range is its scale
  lcp:         VITAL_THRESHOLDS.lcp.good,
  tbt:         VITAL_THRESHOLDS.tbt.good,
  cls:         VITAL_THRESHOLDS.cls.good,
}

/** Scores are the one metric where a rising line is good news. */
const higherIsBetter = (metric: ForecastMetric): boolean => metric === 'performance'

/**
 * Confidence bands. Both the fit quality *and* the amount of evidence have to hold up:
 *   high   — r² ≥ 0.70 and ≥ 6 samples
 *   medium — r² ≥ 0.40 and ≥ 4 samples
 *   low    — everything else (a tight line through 3 points is still just 3 points)
 * A "low" forecast is still returned in full; hiding the number is the UI's call.
 */
function confidenceOf(r2: number, sampleCount: number): MetricForecast['confidence'] {
  if (r2 >= 0.7 && sampleCount >= 6) return 'high'
  if (r2 >= 0.4 && sampleCount >= 4) return 'medium'
  return 'low'
}

export function forecastMetric(
  metric: ForecastMetric,
  samples: ForecastSample[],
  budget?: number | null,
): MetricForecast | null {
  // Drop anything unusable before counting — 3 samples of which one has a broken
  // timestamp is not 3 samples.
  const points = (samples ?? [])
    .map(s => ({ t: Date.parse(s.at), value: s.value }))
    .filter(p => Number.isFinite(p.t) && Number.isFinite(p.value))
    .sort((a, b) => a.t - b.t)

  const n = points.length
  if (n < MIN_SAMPLES) return null

  const t0     = points[0]!.t
  const xs     = points.map(p => (p.t - t0) / DAY_MS)
  const ys     = points.map(p => p.value)
  const meanX  = xs.reduce((a, b) => a + b, 0) / n
  const meanY  = ys.reduce((a, b) => a + b, 0) / n

  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX
    sxx += dx * dx
    sxy += dx * (ys[i]! - meanY)
  }

  // Every audit landed on the same instant: there is no time axis to fit against.
  if (sxx === 0) return null

  const slopePerDay = sxy / sxx
  const intercept   = meanY - slopePerDay * meanX

  // Coefficient of determination. A perfectly constant series has no variance to
  // explain and the line reproduces it exactly, so it scores a clean 1.
  let ssTot = 0
  let ssRes = 0
  for (let i = 0; i < n; i++) {
    const residual = ys[i]! - (intercept + slopePerDay * xs[i]!)
    ssRes += residual * residual
    ssTot += (ys[i]! - meanY) ** 2
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot))

  const lastX   = xs[n - 1]!
  const current = ys[n - 1]!

  const flatCutoff = (METRIC_SCALE[metric] * FLAT_FRACTION_OF_SCALE) / FLAT_HORIZON_DAYS
  const isFlat     = Math.abs(slopePerDay) < flatCutoff

  const direction: MetricForecast['direction'] = isFlat
    ? 'flat'
    : (slopePerDay > 0) === higherIsBetter(metric)
      ? 'improving'
      : 'worsening'

  return {
    metric,
    current,
    slopePerDay,
    r2,
    direction,
    daysToBudget: daysToBudget({
      metric, budget, current, slopePerDay, intercept, lastX, isFlat,
    }),
    confidence: confidenceOf(r2, n),
    sampleCount: n,
  }
}

/**
 * Days from the newest sample until the fitted line reaches `budget`.
 *
 * A score budget is a floor (stay above it), every other budget is a ceiling
 * (stay below it). Returns null when there is no budget, when the budget is
 * already breached, when the trend is flat or heading away from it, or when the
 * crossing is further out than {@link MAX_DAYS_TO_BUDGET}.
 */
function daysToBudget(args: {
  metric:      ForecastMetric
  budget:      number | null | undefined
  current:     number
  slopePerDay: number
  intercept:   number
  lastX:       number
  isFlat:      boolean
}): number | null {
  const { metric, budget, current, slopePerDay, intercept, lastX, isFlat } = args

  if (budget == null || !Number.isFinite(budget)) return null
  if (isFlat) return null

  const isFloor = higherIsBetter(metric)

  // Already on the wrong side of the line — there is nothing left to predict.
  if (isFloor ? current <= budget : current >= budget) return null

  // The value has to be travelling towards the budget: down for a floor, up for a ceiling.
  if (isFloor ? slopePerDay >= 0 : slopePerDay <= 0) return null

  const fittedNow = intercept + slopePerDay * lastX
  const days      = (budget - fittedNow) / slopePerDay

  // Negative means the *fit* is already past the budget even though the last
  // observation is not; that is a breach story, not a forecast.
  if (!Number.isFinite(days) || days < 0 || days > MAX_DAYS_TO_BUDGET) return null

  return Math.round(days * 10) / 10
}
