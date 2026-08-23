/**
 * The account-wide dashboard payload.
 *
 * One request rather than one per site: the page needs alerts, audits and field traffic
 * across every site the user owns, and doing that client-side would be 1 + 2N requests
 * that all have to land before anything can be ranked.
 */

export interface OverviewTotals {
  /** Sites tracked, regardless of whether they have ever been audited. */
  sites:          number;
  /** Sites with at least one successful audit — the denominator for `avgScore`. */
  audited:        number;
  /** Mean performance score across audited sites. 0 when nothing has been audited. */
  avgScore:       number;
  /** Audited sites scoring below the poor threshold. */
  needsAttention: number;
  /** Successful audits recorded in the last 7 days, across all sites. */
  audits7d:       number;
}

export interface OverviewDelivery {
  channel: 'webhook' | 'email';
  ok:      boolean;
}

/**
 * An alert that fired and has not recovered.
 *
 * `delivery` is the point: an incident with an empty array was recorded but never
 * left the server, because no channel was configured or every channel failed. Without
 * showing that, "I never got an alert" is unanswerable.
 */
export interface OverviewIncident {
  id:        string;
  websiteId: string;
  siteUrl:   string;
  /** The audited page, not the site root — budgets are checked per URL. */
  url:       string;
  event:     string;
  metrics:   string[];
  lines:     string[];
  /** What Gemini said when this alert was sent. Absent on alerts raised without AI. */
  aiNote?:   string;
  delivery:  OverviewDelivery[];
  at:        string;
}

export interface OverviewAudit {
  id:          string;
  url:         string;
  score:       number;
  /** Points against the previous successful run of the same URL; null when it is the first. */
  delta:       number | null;
  /** The path alone, for a compact row: the host is already obvious from the site list. */
  routePath:   string;
  at:          string;
}

/** Why a site is listed as needing action. Ordered by how actionable it is. */
export type OverviewAttentionReason =
  | 'breach'        // a budget is broken and has not recovered
  | 'requiresLogin' // the last run hit a login wall, so its numbers are meaningless
  | 'lowScore'      // audited, but below the poor threshold
  | 'neverAudited';

export interface OverviewAttention {
  websiteId: string;
  url:       string;
  name:      string;
  reason:    OverviewAttentionReason;
  /** The site's mean performance score, or null when it has never been audited. */
  score:     number | null;
  /** One line of specifics, e.g. "LCP 4.9s over 2.5s budget". */
  detail:    string | null;
}

export interface OverviewRum {
  pageViews24h:   number;
  /** Sites that reported at least one page view in the window. */
  sitesReporting: number;
  /** Sites with a snippet key issued, whether or not anything has arrived. */
  sitesInstalled: number;
}

/** One day of one site's history. `score` is null on days with no successful run. */
export interface OverviewTrendPoint {
  day:   string;
  score: number | null;
}

export interface OverviewSiteTrend {
  websiteId: string;
  name:      string;
  host:      string;
  points:    OverviewTrendPoint[];
}

export interface OverviewActivityPoint {
  day:    string;
  audits: number;
}

/**
 * How every audited page falls into the web.dev bands for one metric.
 *
 * Counts runs, not sites: the question it answers is "which metric is most often the
 * problem", and a site audited fifty times should weigh more than one audited once.
 */
export interface OverviewVitalSplit {
  metric:           string;
  good:             number;
  needsImprovement: number;
  poor:             number;
}

export interface OverviewCharts {
  /** Window length in days, so the UI can label itself without hardcoding it. */
  days:     number;
  trend:    OverviewSiteTrend[];
  activity: OverviewActivityPoint[];
  vitals:   OverviewVitalSplit[];
}

export interface OverviewData {
  totals:       OverviewTotals;
  incidents:    OverviewIncident[];
  recentAudits: OverviewAudit[];
  attention:    OverviewAttention[];
  /** null when no site has a RUM key — the card then explains what installing it gives. */
  rum:          OverviewRum | null;
  charts:       OverviewCharts;
}

// ─── Notifications ───────────────────────────────────────────────────────────

/**
 * One entry in the bell.
 *
 * The same alerts the dashboard's incident list is built from, but ordered by time rather
 * than by whether they are still open — the bell answers "what happened", not "what is
 * broken", and a recovery is as much news as a breach.
 */
export interface NotificationEntry {
  id:        string
  /** 'budget.breach' | 'budget.recovered' | 'audit.regression' — as stored. */
  event:     string
  status:    'firing' | 'recovered' | 'event'
  /** The audited page. */
  url:       string
  siteUrl:   string
  websiteId: string
  metrics:   string[]
  /** Human-readable bullets, exactly as they were sent. */
  lines:     string[]
  aiNote?:   string
  at:        string
  /** Raised since this account last opened the bell. */
  unread:    boolean
}

export interface NotificationsResponse {
  entries: NotificationEntry[]
  /** How many of them are unread — the badge. Counted server-side over the whole log,
   *  not over the returned page, so a busy account does not under-report. */
  unread:  number
  /** When the account last opened the bell; null if never. */
  seenAt:  string | null
}
