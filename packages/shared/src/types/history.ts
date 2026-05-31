import type { PerformanceScores, CoreWebVitals } from './analysis.js'

export interface HistoryEntry {
  id:        string
  shortId:   string
  url:       string
  timestamp: string
  scores:    PerformanceScores
  metrics:   CoreWebVitals
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
