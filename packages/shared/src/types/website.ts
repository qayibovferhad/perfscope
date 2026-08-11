import type { AuditFormFactor } from './analysis.js'

export interface WebsiteSession {
  cookies:      Array<{
    name?:     string
    value?:    string
    domain?:   string
    path?:     string
    expires?:  number
    httpOnly?: boolean
    secure?:   boolean
    sameSite?: string
  }>
  localStorage: Record<string, string>
  capturedAt:   string
}

/** A group of routes and the time of day they are audited. */
export interface AutomationSlot {
  /** 24-hour local time, 'HH:MM'. */
  time:   string
  routes: string[]
}

/**
 * How a site's routes are distributed across the day.
 * - `single` — every route in one block at `scheduleTime` (the original behaviour)
 * - `slots`  — explicit groups: /checkout at 02:00, /blog at 14:00
 * - `spread` — all routes fanned out evenly across `spreadMinutes` from `scheduleTime`
 */
export type AutomationScheduleMode = 'single' | 'slots' | 'spread'

export interface WebsiteAutomation {
  enabled:      boolean
  /** Every route the site audits. Stays the canonical list in all three modes. */
  routes:       string[]
  /** Start of the run in `single`, start of the window in `spread`. */
  scheduleTime: string
  /** Absent on documents written before slots existed — read it as 'single'. */
  scheduleMode?:  AutomationScheduleMode
  slots?:         AutomationSlot[]
  /** Window length in minutes for `spread`; 60 means "all of them within an hour". */
  spreadMinutes?: number
  lastRunAt:    string | null
}

/** Per-site performance budgets; a metric is checked only when its threshold is set. */
export interface WebsiteBudgets {
  /** Minimum acceptable performance score (0–100). */
  performance?: number | null
  /** Maximum acceptable LCP in ms. */
  lcp?: number | null
  /** Maximum acceptable TBT in ms. */
  tbt?: number | null
  /** Maximum acceptable CLS. */
  cls?: number | null
  /** Maximum acceptable INP in ms. Field-only — no lab run produces this metric. */
  inp?: number | null
  /** POSTed a BudgetBreach payload whenever an audit violates the budgets. */
  webhookUrl?: string | null
  /** Receives a breach summary email (requires SMTP_* configured on the backend). */
  alertEmail?: string | null
}

export interface BudgetFailure {
  metric: 'performance' | 'lcp' | 'tbt' | 'cls' | 'inp' | 'fcp' | 'ttfb'
  value:  number
  budget: number
}

/** Set when the latest audit broke the site's budgets; cleared once the same URL passes. */
export interface BudgetBreach {
  analysisId: string
  url:        string
  formFactor?: AuditFormFactor
  failures:   BudgetFailure[]
  at:         string
}

/** Set when an audit was redirected to a login screen; cleared once that same URL audits cleanly. */
export interface WebsiteLoginWall {
  url:        string
  loginUrl:   string
  detectedAt: string
}

export interface WebsiteDoc {
  _id:            string
  userId:         string
  url:            string
  name:           string
  session?:       WebsiteSession | null
  requiresLogin?: WebsiteLoginWall | null
  automation?:    WebsiteAutomation
  budgets?:       WebsiteBudgets | null
  lastBudgetBreach?: BudgetBreach | null
  createdAt:      string
}
