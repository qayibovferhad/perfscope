export type ScoreRating = 'good' | 'needs-improvement' | 'poor'

/**
 * Lighthouse category bands — the 0-100 score equivalent of VITAL_THRESHOLDS, so a
 * threshold shown in the UI is read from here rather than retyped ("good" is inclusive).
 */
export const SCORE_BANDS = { good: 90, needsImprovement: 50 } as const

export function rateScore(score: number): ScoreRating {
  if (score >= SCORE_BANDS.good) return 'good'
  if (score >= SCORE_BANDS.needsImprovement) return 'needs-improvement'
  return 'poor'
}

/**
 * Metric thresholds per web.dev ("good" is inclusive).
 *
 * Covers both what a lab run measures (tbt, si, tti) and what only real users can
 * produce (inp, ttfb) — field data buckets its samples against the same numbers, so
 * they live together rather than in a second table.
 */
export type VitalKey = 'fcp' | 'lcp' | 'tbt' | 'cls' | 'si' | 'tti' | 'inp' | 'ttfb'

export const VITAL_THRESHOLDS: Record<VitalKey, { good: number; poor: number }> = {
  fcp:  { good: 1800, poor: 3000 },
  lcp:  { good: 2500, poor: 4000 },
  tbt:  { good: 200,  poor: 600  },
  cls:  { good: 0.1,  poor: 0.25 },
  si:   { good: 3400, poor: 5800 },
  tti:  { good: 3800, poor: 7300 },
  inp:  { good: 200,  poor: 500  },
  ttfb: { good: 800,  poor: 1800 },
}

export function rateVital(key: VitalKey, value: number): ScoreRating {
  const t = VITAL_THRESHOLDS[key]
  if (value <= t.good) return 'good'
  if (value <= t.poor) return 'needs-improvement'
  return 'poor'
}

/** Hex per rating, matching the dashboard's dark --ld-* palette (accent/amber/rose). */
export const RATING_COLOR: Record<ScoreRating, string> = {
  good:                '#14c08a',
  'needs-improvement': '#e6a23c',
  poor:                '#f2647a',
}

export const rateLcp = (ms: number): ScoreRating => rateVital('lcp', ms)
export const rateCls = (value: number): ScoreRating => rateVital('cls', value)
export const rateTbt = (ms: number): ScoreRating => rateVital('tbt', ms)
