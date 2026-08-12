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

export interface RouteGroup {
  routePath: string
  entries:   ProjectAuditEntry[]
  trend:     'improving' | 'regressing' | 'stable' | 'single'
  lastScore: number
}

/**
 * One site's scheduled runs, in the shape the project page already renders.
 *
 * Deliberately the same type rather than a parallel one: the scheduled page is that page
 * repeated per site, so it reuses RouteGroupCard, the audit table and the stat strip
 * instead of inventing a second way to show the same thing.
 */
export type ScheduledSiteReport = ProjectAuditsResult

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
