// Core scores — 0-100 integers, mirroring what the backend's toScore() emits
export interface PerformanceScores {
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
}

// All timing in milliseconds; CLS is dimensionless
export interface CoreWebVitals {
  fcp: number
  lcp: number
  tbt: number
  cls: number
  si: number
  tti: number
}

export interface AnalysisResult {
  id: string
  url: string
  timestamp: string
  scores: PerformanceScores
  metrics: CoreWebVitals
  aiInsights?: string
}

export interface WebsiteDoc {
  _id: string
  url: string
  name: string
  userId: string
  createdAt: string
}

export interface HistoryEntry {
  id: string
  shortId: string
  url: string
  timestamp: string
  scores: PerformanceScores
  metrics: CoreWebVitals
}

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
  if (value < 0.1) return 'good'
  if (value < 0.25) return 'needs-improvement'
  return 'poor'
}

export function rateTbt(ms: number): ScoreRating {
  if (ms < 200) return 'good'
  if (ms < 600) return 'needs-improvement'
  return 'poor'
}
