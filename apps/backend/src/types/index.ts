/**
 * Backend types.
 * Domain types (AnalysisResult, scores, vitals, etc.) live in @perfscope/shared
 * and are re-exported here for backwards-compatible imports across the backend.
 * Only genuinely server-side contracts are defined locally: InterServerEvents and
 * SocketData describe the adapter and per-connection state, which no client has a
 * counterpart for. The client-facing socket contract lives in @perfscope/shared, because
 * a contract only one side can see is not a contract.
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
  // The socket contract: both ends of the wire now read the same declarations.
  AuditPrecision,
  AnalysisStartPayload,
  AnalysisCancelPayload,
  AuthAuditStartPayload,
  AnalysisErrorPayload,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@perfscope/shared';

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  analysisId?: string;
}
