export type ScoreRating = 'good' | 'needs-improvement' | 'poor'

export function rateScore(score: number): ScoreRating {
  if (score >= 90) return 'good'
  if (score >= 50) return 'needs-improvement'
  return 'poor'
}

export function rateLcp(ms: number): ScoreRating {
  if (ms < 2500) return 'good'
  if (ms < 4000) return 'needs-improvement'
  return 'poor'
}

export function rateCls(value: number): ScoreRating {
  if (value < 0.1)  return 'good'
  if (value < 0.25) return 'needs-improvement'
  return 'poor'
}

export function rateTbt(ms: number): ScoreRating {
  if (ms < 200) return 'good'
  if (ms < 600) return 'needs-improvement'
  return 'poor'
}
