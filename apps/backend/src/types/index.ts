/**
 * Backend types.
 * Domain types (AnalysisResult, scores, vitals, etc.) live in @perfscope/shared
 * and are re-exported here for backwards-compatible imports across the backend.
 * Only backend-specific contracts (REST request/response, Socket.io events) are defined locally.
 */

// ─── Re-exported domain types ───────────────────────────────────────────────
export type {
  AnalysisStage,
  AnalysisCategory,
  AuditFormFactor,
  AnalysisResult,
  AnalysisProgress,
  CategoryPartial,
  PerformanceScores,
  CoreWebVitals,
  AuditItem,
  AuditImpact,
  ResourceType,
  ResourceTypeSummary,
  ResourceSummary,
  NetworkRequest,
  DetectedLibrary,
  ParsedResources,
  TimelineFrame,
  TimelineData,
  InteractionEvent,
  LongTaskSegment,
  InteractionData,
  HeapMemoryPoint,
  HeapMemoryData,
  FlameCategory,
  FlameChartEvent,
  FlameChartData,
  CLSShiftElement,
  CLSData,
  DependencyNode,
  DependencyLink,
  DependencyGraph,
  MeasurementQuality,
  ThirdPartyEntity,
} from '@perfscope/shared';

// Import a few for use in local socket-event contracts below
import type { AnalysisProgress, AnalysisResult, CategoryPartial, AuditFormFactor } from '@perfscope/shared';

/** How thoroughly an audit measures: one shot, or the median of three runs. */
export type AuditPrecision = 'single' | 'median';

// ─── Backend-specific: REST contracts ───────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?:   T;
  error?:  string;
}

// ─── Backend-specific: Socket.io event signatures ───────────────────────────

export interface ServerToClientEvents {
  'analysis:progress': (data: AnalysisProgress) => void;
  'analysis:partial':  (data: CategoryPartial)  => void;
  'analysis:complete': (result: AnalysisResult) => void;
  // `code` lets the client offer the fix rather than only naming the problem: an expired
  // login session is repaired by capturing a new one, which is one button away.
  'analysis:error':    (data: { analysisId: string; message: string; code?: string }) => void;
}

/**
 * What the client may send. The handlers used to re-declare these payloads inline, so
 * TypeScript never checked one against the other and the contract drifted into fiction:
 * `precision` and `context` were both read by the server and declared nowhere.
 */
export interface ClientToServerEvents {
  'analysis:start': (data: {
    url: string;
    projectId?: string;
    formFactor?: AuditFormFactor;
    /** 'median' measures three times and reports the middle run — slower, far less noisy. */
    precision?: AuditPrecision;
  }) => void;
  'analysis:cancel': (data: { analysisId: string }) => void;
  'auth-audit:start': (data: {
    sessionId: string;
    url: string;
    projectId?: string;
    formFactor?: AuditFormFactor;
    /** A rival's session is stored separately from the user's own sites. */
    context?: 'competitor';
  }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  analysisId?: string;
}
