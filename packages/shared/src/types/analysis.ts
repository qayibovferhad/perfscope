import type { ResourceDiff } from './resourceDiff.js'

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
  /** Lighthouse's own documentation for this audit — generic, identical on every site. */
  description:  string
  score:        number | null
  displayValue: string | undefined
  impact:       AuditImpact
  /**
   * Which Lighthouse category reported this audit — the four the analyzer scores.
   *
   * Optional because audits stored before this field existed have none, and the filter UI
   * hides itself rather than showing a control that would silently drop every older row.
   */
  category?:    AnalysisCategory
  /**
   * Lighthouse's own grouping *inside* that category, as its display title — "Contrast",
   * "Names and labels", "Diagnostics". Accessibility is the category where it earns its
   * keep: forty findings sorted by severity alone are a list, the same forty under their
   * groups are a to-do list. Not every audit belongs to a group.
   */
  group?:       string
  /**
   * What this failure means *on this page*, and the first thing to do about it.
   *
   * Absent when Gemini is not configured, when the call failed, or when the audit passed
   * (only failing audits are explained — explaining a pass costs a token and says nothing).
   */
  aiExplanation?: string
  /** The first few things this audit flagged on this page — the selector, the request,
   *  the value. Capped: an audit with 300 unlabelled images explains itself in three. */
  details?: AuditDetail[]
  /**
   * Lighthouse's own estimate of this audit's total impact — `overallSavingsMs` /
   * `overallSavingsBytes` off the raw LHR, present only on "opportunity" audits that
   * compute one (most diagnostics don't). Previously only reachable as unstructured text
   * inside `displayValue`; kept numeric so a fix can be ranked by real impact instead of
   * a model's own guess at severity.
   */
  savingsMs?:    number
  savingsBytes?: number
}

/** One flagged item from a Lighthouse audit's `details.items`, normalised across the
 *  shapes Lighthouse uses: `node.selector`/`node.snippet` for DOM audits, `url` for
 *  network ones, a wasted-bytes/wasted-ms/total-bytes figure for opportunities. */
export interface AuditDetail {
  selector?: string
  snippet?:  string
  url?:      string
  value?:    string
}

/**
 * What the advisor says about whatever the user is currently looking at.
 *
 * Structured rather than prose because it drives a panel that is on screen continuously:
 * a headline you can read at a glance and up to three steps in the order they should be
 * done. Prose at that frequency turns into wallpaper.
 */
export interface AiAdvice {
  /** At most a dozen words — the one useful thing to say right now. */
  headline: string
  /** Ordered by what to do first. Empty when there is nothing to act on. */
  steps: AiAdviceStep[]
}

export interface AiAdviceStep {
  title:  string
  detail: string
  /**
   * Where this step can actually be carried out, when it maps to something the app does.
   *
   * Advice that says "audit example.com" and leaves you to find the analyzer is a note;
   * the same advice with somewhere to click is a step. Absent when the step is something
   * the user does outside PerfScope — most fixes are.
   */
  action?: AiAdviceAction
}

/**
 * A closed set on purpose. The model picks a `kind`, and the server checks the `url`
 * against sites the user actually has before it goes out — a link invented from nothing is
 * worse than no link.
 */
export interface AiAdviceAction {
  kind: 'audit' | 'schedule' | 'compare' | 'budgets'
  /** One of the user's own site URLs. */
  url:  string
}

/**
 * Everything Gemini has to say about one audit, from a single pass over it.
 *
 * The analyzer used to ask four separate questions — top fixes, per-vital notes, a
 * waterfall narrative, per-audit explanations — each in its own request, each seeing only
 * its own slice. They disagreed: one blamed a hero image at 3.8s, another blamed audio and
 * API payloads at 2.8s, a third blamed translation files at 2.6s, all about the same load.
 *
 * One diagnosis, then every surface derived from it, so they cannot contradict each other.
 */
export interface AiPageAnalysis {
  /** One sentence: what is actually wrong with this page. The others hang off it. */
  diagnosis: string
  /** Three fixes, in the order worth doing. */
  fixes:     string[]
  /** Per vital that is not already good. */
  metrics:   AiMetricNotes
  /** How this load actually went, in prose. */
  waterfall: string | null
  /** Keyed by `AuditItem.id` — why this one fails *here*, not what the audit means. */
  audits:    Record<string, string>
}

/** A short note per Core Web Vital, keyed by the vital. Only non-good vitals get one. */
export type AiMetricNotes = Partial<Record<keyof CoreWebVitals, string>>

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

/**
 * The run this one is compared against — what moved, and what shipped that moved it.
 *
 * Attached server-side before `analysis:complete` is emitted and stored with the result,
 * so the live view, a reopened history row, the public report and the CLI all describe the
 * same comparison. The client never fetches the previous run itself: two clients asking at
 * different times would compare against different runs and disagree about the same audit.
 *
 * Absent when there is no earlier audit of this URL for this owner *at the same form
 * factor* — a desktop run is not the predecessor of a mobile one.
 */
export interface PreviousRunSummary {
  /** Identifies the compared-against run, so the UI can link straight to it. */
  analysisId: string
  /** ISO timestamp of that run. */
  at:         string
  scores:     PerformanceScores
  metrics:    CoreWebVitals
  /** Resource-level movement. Absent when nothing crossed the noise floors. */
  resourceDiff?: ResourceDiff
  /** Ids of audits failing now that were not failing then. */
  newAuditIds: string[]
  /** Audits that were failing then and are not in this run's list any more. */
  fixedAudits: { id: string; title: string }[]
}

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
  /** Three prioritised fixes for the page as a whole. */
  aiInsights?:           string
  /** Per-vital commentary, for the vitals that are not already good. */
  aiMetricNotes?:        AiMetricNotes
  /** Two or three sentences narrating how this page actually loaded. */
  aiWaterfallNarrative?: string
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
  /** The previous run of this URL, and what changed since it. Absent when there is none. */
  previous?:             PreviousRunSummary
}

export interface AnalysisProgress {
  analysisId: string
  stage:      AnalysisStage
  progress:   number
  message:    string
}

