import type { AuditFormFactor } from './analysis.js'

/**
 * A captured session, as the client is allowed to see it: that one exists, and when it
 * was taken. The cookies and localStorage behind it are live credentials for the audited
 * site and never leave the backend — they live in `models/session.schema.ts`, and the
 * `toJSON` transform there strips them from every response.
 *
 * Whether a session still *works* is a separate question, answered by `requiresLogin`;
 * see `sessionState()` on the dashboard, which needs both.
 */
export interface WebsiteSession {
  capturedAt: string
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

/**
 * One lab budget that a stored audit broke.
 *
 * Only these four: `Website.budgets` also accepts `inp`, but no lab run can measure it, so
 * it is checked against RUM p75 in rumBudget.service — which raises an alert and never
 * writes `lastBudgetBreach`. The union used to claim inp/fcp/ttfb as well, which nothing
 * could ever produce here.
 */
export interface BudgetFailure {
  metric: 'performance' | 'lcp' | 'tbt' | 'cls'
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

/**
 * A page of results and where it sits in the whole.
 *
 * Generic in the item because the two ends hold different things: the server has mongoose
 * documents with ObjectIds and Dates, the client has what JSON made of them. The envelope
 * is the part both must agree on, and the part that had drifted — so the server annotates
 * `Paginated<IWebsite>` and the client `WebsitePage`, and a renamed field breaks both.
 *
 * `page` is the page actually served, which is not always the one asked for: the route
 * counts first and clamps, so requesting page 99 of 3 answers page 3 rather than an empty
 * list that claims to be page 99.
 */
export interface Paginated<T> {
  items:      T[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

export type WebsitePage = Paginated<WebsiteDoc>

/**
 * The headline strip above the website list, from `GET /api/websites/summary`.
 *
 * Deliberately ignores the list's search term so the numbers stay put while the user
 * types. `avgScore` is 0 for an account with no successful audits, not null — the tile
 * always shows a number.
 */
export interface WebsiteSummary {
  total:          number
  audited:        number
  avgScore:       number
  needsAttention: number
}
