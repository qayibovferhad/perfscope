/** Which device profile a Lighthouse run emulated. */
export type AuditFormFactor = 'mobile' | 'desktop'

// ─── Categories & stages ─────────────────────────────────────────────────────

export type AnalysisStage    = 'launching' | 'navigating' | 'auditing' | 'processing' | 'complete' | 'error'
export type AnalysisCategory = 'performance' | 'accessibility' | 'best-practices' | 'seo'
export type AuditImpact      = 'critical' | 'high' | 'medium' | 'low'
export type ResourceType     = 'script' | 'stylesheet' | 'image' | 'font' | 'document' | 'media' | 'other'
export type FlameCategory    = 'scripting' | 'rendering' | 'painting' | 'other'

// ─── Scores & metrics ────────────────────────────────────────────────────────

export interface PerformanceScores {
  performance:   number
  accessibility: number
  bestPractices: number
  seo:           number
}

export interface CoreWebVitals {
  fcp: number
  lcp: number
  tbt: number
  cls: number
  si:  number
  tti: number
}

// ─── Audits ──────────────────────────────────────────────────────────────────

export interface AuditItem {
  id:           string
  title:        string
  description:  string
  score:        number | null
  displayValue: string | undefined
  impact:       AuditImpact
}

export interface CategoryPartial {
  analysisId: string
  category:   AnalysisCategory
  score:      number
  metrics?:   CoreWebVitals
  audits:     AuditItem[]
}

// ─── Resources / network ─────────────────────────────────────────────────────

export interface ResourceTypeSummary {
  requestCount: number
  transferSize: number
  resourceSize: number
}

export interface ResourceSummary {
  script:     ResourceTypeSummary
  stylesheet: ResourceTypeSummary
  image:      ResourceTypeSummary
  font:       ResourceTypeSummary
  document:   ResourceTypeSummary
  media:      ResourceTypeSummary
  other:      ResourceTypeSummary
  total:      ResourceTypeSummary
}

export interface NetworkRequest {
  url:                 string
  resourceType:        ResourceType
  transferSize:        number
  resourceSize:        number
  statusCode:          number
  mimeType:            string
  isThirdParty:        boolean
  detectedLibrary:     string | null
  isCritical:          boolean
  advice?:             string
  /** Milliseconds from navigation start */
  startTime:           number
  /** Milliseconds from navigation start */
  endTime:             number
  /** Time to First Byte (ms) */
  ttfb:                number
  /** Content download duration (ms) */
  contentDownloadTime: number
}

export interface DetectedLibrary {
  name:         string
  url:          string
  transferSize: number
  isThirdParty: boolean
  isCritical:   boolean
}

export interface ParsedResources {
  requests:           NetworkRequest[]
  summary:            ResourceSummary
  thirdPartyRequests: NetworkRequest[]
  jsFiles:            NetworkRequest[]
  detectedLibraries:  DetectedLibrary[]
}

// ─── Measurement quality ─────────────────────────────────────────────────────

/**
 * How the reported performance numbers were produced. A single Lighthouse run
 * swings by ±10 points on the same page, so anything derived from one shot
 * (trends, regressions, budget breaches) is partly noise. When `runs > 1` the
 * reported result is the median run and `spread` says how noisy the page is.
 */
export interface MeasurementQuality {
  /** Performance iterations executed (1 = single shot). */
  runs:   number
  /** Performance score of every iteration, in run order. */
  scores: number[]
  /** Score of the run whose artifacts this result carries. */
  median: number
  /** max − min across iterations; large values mean the page measures unreliably. */
  spread: number
}

// ─── Third parties ───────────────────────────────────────────────────────────

/** Per-vendor cost, from Lighthouse's third-party-summary audit. */
export interface ThirdPartyEntity {
  /** Vendor name as Lighthouse identifies it (e.g. "Google Tag Manager"). */
  name:           string
  transferSize:   number
  /** Total main-thread time attributed to this vendor (ms). */
  mainThreadTime: number
  /** Portion of main-thread time that blocked interactivity (ms). */
  blockingTime:   number
  requestCount:   number
}

// ─── Timeline / filmstrip ────────────────────────────────────────────────────

export interface TimelineFrame {
  /** ms from navigationStart */
  timing: number
  /** data: URL */
  data:   string
}

export interface TimelineData {
  frames:  TimelineFrame[]
  metrics: { fcp: number; lcp: number; tti: number; tbt: number }
  /** ms from navigationStart to the earliest network request */
  networkOffsetMs: number
}

// ─── Interaction / INP ───────────────────────────────────────────────────────

export interface InteractionEvent {
  id:                   string
  type:                 string
  startMs:              number
  inputDelayMs:         number
  processingTimeMs:     number
  presentationDelayMs:  number
  totalDurationMs:      number
  targetElement:        string
  blockingFunctionName: string | null
  isUserInput:          boolean
  isINP:                boolean
}

export interface LongTaskSegment {
  startMs:          number
  durationMs:       number
  topFunctionName?: string
}

export interface InteractionData {
  events:              InteractionEvent[]
  longTasks:           LongTaskSegment[]
  inpMs:               number
  avgInputDelayMs:     number
  totalBlockingTimeMs: number
}

// ─── Heap memory ─────────────────────────────────────────────────────────────

export interface HeapMemoryPoint {
  timeMs:    number
  heapMb:    number
  isGC:      boolean
  domNodes?: number
}

export interface HeapMemoryData {
  points:    HeapMemoryPoint[]
  averageMb: number
  peakMb:    number
}

// ─── Flame chart ─────────────────────────────────────────────────────────────

export interface FlameChartEvent {
  name:       string
  category:   FlameCategory
  startMs:    number
  durationMs: number
  depth:      number
  url?:       string
  isLongTask: boolean
}

export interface FlameChartData {
  events:     FlameChartEvent[]
  maxDepth:   number
  durationMs: number
}

// ─── CLS visualizer ──────────────────────────────────────────────────────────

export interface CLSShiftElement {
  selector:    string
  snippet:     string
  score:       number
  impact:      'high' | 'medium' | 'low'
  rootCause?:  string
  rect?:       { topPct: number; leftPct: number; widthPct: number; heightPct: number }
}

export interface CLSData {
  totalScore:     number
  elements:       CLSShiftElement[]
  viewportWidth:  number
  viewportHeight: number
}

// ─── Dependency graph ────────────────────────────────────────────────────────

export interface DependencyNode {
  url:          string
  label:        string
  resourceType: ResourceType
  transferSize: number
}

export interface DependencyLink {
  source:       string
  target:       string
  transferSize: number
}

export interface DependencyGraph {
  nodes: DependencyNode[]
  links: DependencyLink[]
}

// ─── Result root + progress ──────────────────────────────────────────────────

export interface AnalysisResult {
  /** Device profile the audit ran with; absent on results saved before the toggle existed. */
  formFactor?: AuditFormFactor
  id:                    string
  url:                   string
  timestamp:             string
  scores:                PerformanceScores
  metrics:               CoreWebVitals
  audits:                AuditItem[]
  resources?:            ParsedResources
  aiInsights?:           string
  timelineData?:         TimelineData
  flameChartData?:       FlameChartData
  dependencyGraph?:      DependencyGraph
  heapMemoryData?:       HeapMemoryData
  interactionData?:      InteractionData
  clsData?:              CLSData
  /** Set when Lighthouse was redirected to an auth/login page instead of the requested URL. */
  authRedirectDetected?: { finalUrl: string }
  /** Present when the run was measured more than once (median reporting). */
  measurement?:          MeasurementQuality
  /** Vendors loaded by the page, heaviest first. */
  thirdParty?:           ThirdPartyEntity[]
}

export interface AnalysisProgress {
  analysisId: string
  stage:      AnalysisStage
  progress:   number
  message:    string
}

