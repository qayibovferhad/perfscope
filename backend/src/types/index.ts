// ─── Analysis Domain Types ──────────────────────────────────────────────────

export type AnalysisStage =
  | 'launching'
  | 'navigating'
  | 'auditing'
  | 'processing'
  | 'complete'
  | 'error';

export type AuditImpact = 'critical' | 'high' | 'medium' | 'low';

export type AnalysisCategory = 'performance' | 'accessibility' | 'best-practices' | 'seo';

export interface AnalysisProgress {
  analysisId: string;
  stage: AnalysisStage;
  progress: number; // 0–100
  message: string;
}

export interface CategoryPartial {
  analysisId: string;
  category: AnalysisCategory;
  score: number;
  metrics?: CoreWebVitals; // only for 'performance'
  audits: AuditItem[];
}

export interface AuditItem {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue: string | undefined;
  impact: AuditImpact;
}

export interface PerformanceScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface CoreWebVitals {
  fcp: number;
  lcp: number;
  tbt: number;
  cls: number;
  si: number;
  tti: number;
}

export interface TimelineFrame {
  /** Milliseconds from page load start */
  timing: number;
  /** Data URL (data:image/jpeg;base64,...) */
  data: string;
}

export interface TimelineData {
  frames: TimelineFrame[];
  metrics: {
    fcp: number;
    lcp: number;
    tti: number;
    tbt: number;
  };
  /**
   * Milliseconds between navigationStart and the earliest network request.
   * Lighthouse normalizes all request times so the first request = 0ms,
   * but frame timings use navigationStart as 0ms.
   * Apply: adjustedRequestMs = sliderMs (frame-time) - networkOffsetMs
   * to compare slider position against request start/end times.
   */
  networkOffsetMs: number;
}

export interface AnalysisResult {
  id: string;
  url: string;
  timestamp: string;
  scores: PerformanceScores;
  metrics: CoreWebVitals;
  audits: AuditItem[];
  resources?: ParsedResources;
  aiInsights?: string;
  timelineData?: TimelineData;
}

// ─── Resource Analysis Types ─────────────────────────────────────────────────

export type ResourceType = 'script' | 'stylesheet' | 'image' | 'font' | 'document' | 'media' | 'other';

export interface NetworkRequest {
  url: string;
  resourceType: ResourceType;
  /** Compressed size over the wire (bytes) */
  transferSize: number;
  /** Uncompressed decoded size (bytes) */
  resourceSize: number;
  statusCode: number;
  mimeType: string;
  isThirdParty: boolean;
  /** Library name detected from URL, e.g. "react", "lodash" */
  detectedLibrary: string | null;
  /** JS > 500 KB or image > 1 MB */
  isCritical: boolean;
  /** Gemini-generated optimization advice for critical resources */
  advice?: string;
  /** Milliseconds from navigation start (Lighthouse network-requests audit) */
  startTime: number;
  /** Milliseconds from navigation start */
  endTime: number;
  /** Time to First Byte — ms from startTime until first byte received */
  ttfb: number;
  /** Content download duration — ms from first byte to response end */
  contentDownloadTime: number;
}

export interface ResourceTypeSummary {
  requestCount: number;
  transferSize: number;
  resourceSize: number;
}

export interface ResourceSummary {
  script: ResourceTypeSummary;
  stylesheet: ResourceTypeSummary;
  image: ResourceTypeSummary;
  font: ResourceTypeSummary;
  document: ResourceTypeSummary;
  media: ResourceTypeSummary;
  other: ResourceTypeSummary;
  total: ResourceTypeSummary;
}

export interface DetectedLibrary {
  name: string;
  url: string;
  transferSize: number;
  isThirdParty: boolean;
  isCritical: boolean;
}

export interface ParsedResources {
  /** All network requests */
  requests: NetworkRequest[];
  /** Aggregated sizes per resource type (from resource-summary audit) */
  summary: ResourceSummary;
  /** Only third-party requests */
  thirdPartyRequests: NetworkRequest[];
  /** Only JS/CSS files with size info */
  jsFiles: NetworkRequest[];
  /** Deduplicated list of detected libraries */
  detectedLibraries: DetectedLibrary[];
}

// ─── API Request / Response Types ───────────────────────────────────────────

export interface StartAnalysisBody {
  url: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StartAnalysisResponse {
  analysisId: string;
  message: string;
}

// ─── Socket Event Types ──────────────────────────────────────────────────────

export interface ServerToClientEvents {
  'analysis:progress': (data: AnalysisProgress) => void;
  'analysis:partial': (data: CategoryPartial) => void;
  'analysis:complete': (result: AnalysisResult) => void;
  'analysis:error': (data: { analysisId: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'analysis:start': (data: { url: string }) => void;
  'analysis:cancel': (data: { analysisId: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  analysisId?: string;
}
