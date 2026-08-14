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
  analysisId: string
}

export interface AuthAuditStartPayload {
  sessionId: string
  url: string
  projectId?: string
  formFactor?: AuditFormFactor
  /** A rival's session is stored separately from the user's own sites. */
  context?: 'competitor'
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
  'analysis:error':    (data: AnalysisErrorPayload) => void
}

/** What the client may send. */
export interface ClientToServerEvents {
  'analysis:start':   (data: AnalysisStartPayload) => void
  /** Handled by the server; no client emits it today. */
  'analysis:cancel':  (data: AnalysisCancelPayload) => void
  'auth-audit:start': (data: AuthAuditStartPayload) => void
}
