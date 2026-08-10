export type ScoreRating = 'good' | 'needs-improvement' | 'poor'

export function rateScore(score: number): ScoreRating {
  if (score >= 90) return 'good'
  if (score >= 50) return 'needs-improvement'
  return 'poor'
}

/** Core Web Vitals + lab metrics, thresholds per web.dev ("good" is inclusive). */
export type VitalKey = 'fcp' | 'lcp' | 'tbt' | 'cls' | 'si' | 'tti'

export const VITAL_THRESHOLDS: Record<VitalKey, { good: number; poor: number }> = {
  fcp: { good: 1800, poor: 3000 },
  lcp: { good: 2500, poor: 4000 },
  tbt: { good: 200,  poor: 600  },
  cls: { good: 0.1,  poor: 0.25 },
  si:  { good: 3400, poor: 5800 },
  tti: { good: 3800, poor: 7300 },
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
