import type { AuditFormFactor } from './analysis.js'

/**
 * Chrome UX Report (field data) — what real Chrome users experienced, as opposed
 * to the lab numbers a Lighthouse run produces.
 */
import type { FieldMetricKey } from '../lib/rating.js'

/** CrUX reports the field metrics and nothing else. */
export type CruxMetricKey = FieldMetricKey

export interface CruxMetric {
  /** 75th percentile — the value Google grades the metric on. */
  p75: number
  /** Share of samples in each bucket, 0–1. */
  good:             number
  needsImprovement: number
  poor:             number
}

export interface CruxData {
  /** The exact page when CrUX has URL-level data, otherwise the whole origin. */
  scope:      'url' | 'origin'
  url:        string
  formFactor: AuditFormFactor
  /** Collection window reported by the API (YYYY-MM-DD). */
  collectedFrom: string
  collectedTo:   string
  metrics:    Partial<Record<CruxMetricKey, CruxMetric>>
}
