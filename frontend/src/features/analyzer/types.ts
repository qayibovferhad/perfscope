export type AuditImpact = 'critical' | 'high' | 'medium' | 'low';
export type ResourceType = 'script' | 'stylesheet' | 'image' | 'font' | 'document' | 'media' | 'other';

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

export interface NetworkRequest {
  url: string;
  resourceType: ResourceType;
  transferSize: number;
  resourceSize: number;
  statusCode: number;
  mimeType: string;
  isThirdParty: boolean;
  detectedLibrary: string | null;
  isCritical: boolean;
  advice?: string;
  /** Milliseconds from navigation start */
  startTime: number;
  /** Milliseconds from navigation start */
  endTime: number;
  /** Time to First Byte in ms */
  ttfb: number;
  /** Content download duration in ms */
  contentDownloadTime: number;
}

export interface DetectedLibrary {
  name: string;
  url: string;
  transferSize: number;
  isThirdParty: boolean;
  isCritical: boolean;
}

export interface ParsedResources {
  requests: NetworkRequest[];
  summary: ResourceSummary;
  thirdPartyRequests: NetworkRequest[];
  jsFiles: NetworkRequest[];
  detectedLibraries: DetectedLibrary[];
}
export type AnalysisStage = 'launching' | 'navigating' | 'auditing' | 'processing' | 'complete' | 'error';
export type AnalysisCategory = 'performance' | 'accessibility' | 'best-practices' | 'seo';

export interface CategoryPartial {
  analysisId: string;
  category: AnalysisCategory;
  score: number;
  metrics?: CoreWebVitals;
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
  timing: number;
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
  /** ms from navigationStart to the earliest network request (global clock offset) */
  networkOffsetMs: number;
}

export interface HeapMemoryPoint {
  timeMs: number;
  heapMb: number;
  isGC:   boolean;
}

export interface HeapMemoryData {
  points:    HeapMemoryPoint[];
  averageMb: number;
  peakMb:    number;
}

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

export interface DependencyNode {
  url: string;
  label: string;
  resourceType: ResourceType;
  transferSize: number;
}

export interface DependencyLink {
  source: string;
  target: string;
  transferSize: number;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  links: DependencyLink[];
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
  flameChartData?:  FlameChartData;
  dependencyGraph?: DependencyGraph;
  heapMemoryData?:  HeapMemoryData;
}

export interface AnalysisProgress {
  analysisId: string;
  stage: AnalysisStage;
  progress: number;
  message: string;
}
