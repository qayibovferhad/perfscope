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

// ─── Interaction / INP Types ─────────────────────────────────────────────────

export interface InteractionEvent {
  id: string;
  /** Event type: 'click', 'keydown', 'load', etc. */
  type: string;
  /** Milliseconds from navigationStart when the event was dispatched */
  startMs: number;
  /** Estimated time the main thread was blocked before handling this input */
  inputDelayMs: number;
  /** Duration of the EventDispatch handler on the main thread */
  processingTimeMs: number;
  /** Time from processing end to the next frame paint */
  presentationDelayMs: number;
  /** inputDelayMs + processingTimeMs + presentationDelayMs */
  totalDurationMs: number;
  /** CSS-like selector of the target element, e.g. 'BUTTON#submit-btn' */
  targetElement: string;
  /** Name of the JS function / script that caused the most blocking, if identifiable */
  blockingFunctionName: string | null;
  /** True when the event type is a direct user input (click, keydown, pointer…) */
  isUserInput: boolean;
  /** True for the interaction with the highest totalDurationMs (INP candidate) */
  isINP: boolean;
}

export interface LongTaskSegment {
  /** Milliseconds from navigationStart */
  startMs: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Longest-running function / event name found inside this task */
  topFunctionName?: string;
}

export interface InteractionData {
  events: InteractionEvent[];
  /** Long tasks (≥ 50ms) on the main thread — used to draw blocking zones */
  longTasks: LongTaskSegment[];
  /** Max totalDurationMs across all interactions (INP value) */
  inpMs: number;
  /** Average inputDelayMs across all interactions */
  avgInputDelayMs: number;
  /** Sum of all long-task blocking time beyond 50ms threshold */
  totalBlockingTimeMs: number;
}

// ─── Heap Memory Types ───────────────────────────────────────────────────────

export interface HeapMemoryPoint {
  /** Milliseconds from navigationStart */
  timeMs: number;
  /** JS heap used size in megabytes */
  heapMb: number;
  /** True when a sharp memory drop (GC) was detected at this point */
  isGC: boolean;
}

export interface HeapMemoryData {
  points:    HeapMemoryPoint[];
  averageMb: number;
  peakMb:    number;
}

// ─── Flame Chart Types ───────────────────────────────────────────────────────

export type FlameCategory = 'scripting' | 'rendering' | 'painting' | 'other';

export interface FlameChartEvent {
  name: string;
  category: FlameCategory;
  startMs: number;
  durationMs: number;
  depth: number;
  url?: string;
  isLongTask: boolean;
}

export interface FlameChartData {
  events: FlameChartEvent[];
  maxDepth: number;
  durationMs: number;
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
  flameChartData?: FlameChartData;
  dependencyGraph?: DependencyGraph;
  heapMemoryData?: HeapMemoryData;
  interactionData?: InteractionData;
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

// ─── Dependency Graph Types ──────────────────────────────────────────────────

export interface DependencyNode {
  url: string;
  /** Short filename label, e.g. "jquery.min.js" */
  label: string;
  resourceType: ResourceType;
  transferSize: number;
}

export interface DependencyLink {
  /** URL of the initiating resource */
  source: string;
  /** URL of the loaded resource */
  target: string;
  /** transferSize of the target resource in bytes */
  transferSize: number;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  links: DependencyLink[];
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
