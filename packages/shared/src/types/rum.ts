import type { AuditFormFactor } from './analysis.js'
import type { FieldMetricKey } from '../lib/rating.js'
import { FIELD_METRIC_KEYS } from '../lib/rating.js'
import type { CruxMetric } from './crux.js'

/**
 * Real User Monitoring — what your own visitors actually experienced.
 *
 * Complements the other two views rather than replacing them. A Lighthouse run is a lab
 * measurement of one synthetic load; CrUX is real Chrome users but public, 28-day, and
 * only for pages popular enough to qualify. RUM is your traffic, every browser, as it
 * happens — and it is the only one that can see a page behind a login.
 *
 * Deliberately shaped like CruxData so the dashboard can put them side by side.
 */

/** Metrics a browser can report from a real page view. */
/** Our collector reports the same five metrics CrUX does — deliberately, see above. */
export type RumMetricKey = FieldMetricKey

export const RUM_METRIC_KEYS: readonly RumMetricKey[] = FIELD_METRIC_KEYS

/** One page view's measurements. Every metric is optional — a visitor may leave early. */
export interface RumSample {
  lcp?:  number
  inp?:  number
  cls?:  number
  fcp?:  number
  ttfb?: number
}

/** What the collector beacons. Kept small: it travels on the visitor's connection. */
export interface RumBeacon extends RumSample {
  /** Public site key identifying which Website this belongs to. */
  key:  string
  /** Path only — query strings and fragments are dropped before they leave the page. */
  path: string
  /** Coarse device class, derived from viewport width. */
  device: AuditFormFactor
  /** Collector version, so a payload shape change is diagnosable server-side. */
  v: number
}

/**
 * Field data for one metric, from our own collector.
 *
 * Structurally CrUX's shape plus a sample count — deliberately, so the Field data tab can
 * render either source through the same components. Extending says so rather than leaving
 * two identical blocks to drift.
 */
export interface RumMetricSummary extends CruxMetric {
  /** How many page views contributed this metric. */
  samples: number
}

export interface RumSummary {
  /** Whole site, or a single path when one was requested. */
  scope:  'site' | 'path'
  path:   string | null
  /** Both device classes together, or one when filtered. */
  device: AuditFormFactor | 'all'
  from:   string
  to:     string
  /** Distinct page views in the window — the denominator for every metric. */
  pageViews: number
  metrics: Partial<Record<RumMetricKey, RumMetricSummary>>
}

/** One day of field data for a single metric. */
export interface RumTrendPoint {
  /** UTC day, YYYY-MM-DD. */
  day:       string
  p75:       number | null
  pageViews: number
}

export interface RumTrend {
  metric: RumMetricKey
  points: RumTrendPoint[]
}

/** Busiest paths in the window, so the dashboard can show where the traffic is. */
export interface RumPathRow {
  path:      string
  pageViews: number
  /** p75 LCP for that path, or null when no sample carried one. */
  lcp:       number | null
}
