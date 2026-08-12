import type { PerformanceScores, CoreWebVitals } from './analysis.js'

/** Who asked for a run: a person, or the site's timetable. */
export type AuditSource = 'manual' | 'scheduled'

export interface HistoryEntry {
  id:        string
  shortId:   string
  url:       string
  timestamp: string
  scores:    PerformanceScores
  metrics:   CoreWebVitals
  /** Absent on audits stored before the distinction existed — those were all manual. */
  source?:   AuditSource
}

export interface ProjectAuditEntry extends HistoryEntry {
  routePath: string
}

/** One site's scheduled runs, grouped by the route they measured. */
export interface ScheduledRouteGroup {
  routePath: string
  entries:   ProjectAuditEntry[]
}

export interface ScheduledSiteGroup {
  websiteId: string
  name:      string
  url:       string
  /** Newest run across every route, so the page can lead with what happened last. */
  lastRunAt: string
  runs:      number
  routes:    ScheduledRouteGroup[]
}

export interface RouteGroup {
  routePath: string
  entries:   ProjectAuditEntry[]
  trend:     'improving' | 'regressing' | 'stable' | 'single'
  lastScore: number
}

export interface ProjectAuditsResult {
  project: { id: string; name: string; url: string }
  groups:  RouteGroup[]
  stats: {
    totalAudits:    number
    avgPerformance: number
    uniqueRoutes:   number
    lastAuditAt:    string | null
  }
}
