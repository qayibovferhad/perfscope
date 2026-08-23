import type {
  AnalysisProgress,
  AnalysisResult,
  CategoryPartial,
  AuditFormFactor,
} from './analysis.js'

/**
 * The Socket.io contract, as both ends must agree on it.
 *
 * This lived on the backend, where only the handler consumed it, while the dashboard and
 * the CLI each retyped the event names and payloads by hand. Nothing checked one against
 * the other, so the contract had already drifted into fiction once: `precision` and
 * `context` were read by the server and declared nowhere.
 *
 * Deliberately imports nothing from socket.io or socket.io-client — these are plain
 * interfaces, so this package stays dependency-free and the same declarations serve the
 * server, the browser and anything else that speaks the protocol.
 *
 * The CLI mirrors these by hand (packages/cli/bin/cli.js): it publishes to npm standalone
 * and cannot take a workspace dependency. Change one, check the other.
 */

/** How thoroughly an audit measures: one shot, or the median of three runs. */
export type AuditPrecision = 'single' | 'median'

export interface AnalysisStartPayload {
  url: string
  projectId?: string
  formFactor?: AuditFormFactor
  /** 'median' measures three times and reports the middle run — slower, far less noisy. */
  precision?: AuditPrecision
}

export interface AnalysisCancelPayload {
  /**
   * Which audit to stop, or `null` for "the one I just started".
   *
   * The server mints the id and the client only learns it from the first progress event.
   * Stop pressed inside that window — which is what someone does the moment they notice
   * they typed the wrong URL — had no id to send, so nothing was sent and nothing stopped.
   * The server resolves a null against the runs that socket has in flight.
   */
  analysisId: string | null
}

export interface AuthAuditStartPayload {
  sessionId: string
  url: string
  projectId?: string
  formFactor?: AuditFormFactor
  /** A rival's session is stored separately from the user's own sites. */
  context?: 'competitor'
}

/**
 * AI commentary, delivered after `analysis:complete`.
 *
 * Insights come from a second network round trip to Gemini that takes 2–4 s. Waiting for
 * it before `complete` made every audit that much slower for a panel most people scroll to
 * last — and while the model name was dead, that wait bought a 404. So the scores ship
 * the moment they exist and this follows when it can. `analysisId` is the correlation:
 * the client must ignore it for any other analysis, exactly as it does for progress.
 *
 * **Always emitted, even with every field empty.** That is the client's only signal that
 * the AI phase is over: pending, failed and "no API key on this deployment" are otherwise
 * indistinguishable, and a skeleton with no end condition would spin forever. When Gemini
 * is unconfigured the empty event arrives immediately.
 */
export interface AnalysisInsightsPayload {
  analysisId: string
  insights: string
  /** Per-resource tips keyed by request URL — the same map `NetworkRequest.advice` is filled from. */
  advice?: Record<string, string>
  /** Per-audit explanations keyed by `AuditItem.id`. */
  auditExplanations?: Record<string, string>
  /** Per-vital notes keyed by the vital, for vitals that are not already good. */
  metricNotes?: Record<string, string>
  /** How the page loaded, in prose. */
  waterfall?: string
}

export interface AnalysisErrorPayload {
  analysisId: string
  message: string
  /**
   * Lets the client offer the fix rather than only naming the problem: an expired login
   * session is repaired by capturing a new one, which is one button away.
   */
  code?: string
}

export interface ServerToClientEvents {
  'analysis:progress': (data: AnalysisProgress) => void
  'analysis:partial':  (data: CategoryPartial)  => void
  'analysis:complete': (result: AnalysisResult) => void
  'analysis:insights': (data: AnalysisInsightsPayload) => void
  'analysis:error':    (data: AnalysisErrorPayload) => void
}

/** What the client may send. */
export interface ClientToServerEvents {
  'analysis:start':   (data: AnalysisStartPayload) => void
  /** Handled by the server; no client emits it today. */
  'analysis:cancel':  (data: AnalysisCancelPayload) => void
  'auth-audit:start': (data: AuthAuditStartPayload) => void
}
