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
} from '@perfscope/shared';

// Import a few for use in local socket-event contracts below
import type { AnalysisProgress, AnalysisResult, CategoryPartial } from '@perfscope/shared';

// ─── Backend-specific: REST contracts ───────────────────────────────────────

export interface StartAnalysisBody {
  url: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?:   T;
  error?:  string;
}

export interface StartAnalysisResponse {
  analysisId: string;
  message:    string;
}

// ─── Backend-specific: Socket.io event signatures ───────────────────────────

export interface ServerToClientEvents {
  'analysis:progress': (data: AnalysisProgress) => void;
  'analysis:partial':  (data: CategoryPartial)  => void;
  'analysis:complete': (result: AnalysisResult) => void;
  'analysis:error':    (data: { analysisId: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'analysis:start':    (data: { url: string; projectId?: string }) => void;
  'analysis:cancel':   (data: { analysisId: string }) => void;
  'auth-audit:start':  (data: { sessionId: string; url: string; projectId?: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  analysisId?: string;
}
