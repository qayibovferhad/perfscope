/**
 * User flows — measuring what happens *after* the page has loaded.
 *
 * Every audit in this product until now measured one cold navigation: Chrome opens a URL,
 * the numbers are taken, the run ends. That misses the half of a web app people actually
 * complain about — the click that freezes for a third of a second, the modal that shoves
 * the page down as it opens, the dialog whose contrast nobody ever audited because it does
 * not exist until you press something.
 *
 * Lighthouse can measure those in three modes, and the difference between them is the whole
 * shape of this feature:
 *
 * - **navigation** — a cold load. What PerfScope has always done; the only mode with LCP,
 *   FCP and Speed Index, because they describe a page appearing.
 * - **timespan** — a window of time containing interactions. Reports **INP**, TBT and any
 *   layout shift the user did not cause. This is the mode that answers "is this button
 *   slow", and INP is field-only everywhere else in this product (see `targets.ts`).
 * - **snapshot** — the DOM as it stands right now. No timing at all; its value is
 *   accessibility and best-practices on a *state*, which a cold load can never reach.
 *
 * A step's mode decides which of its numbers mean anything, which is why `FlowStepResult`
 * carries the mode and every reader branches on it rather than assuming a shape.
 */

/** What a step does to the page before it is measured. */
export type FlowActionKind =
  | 'click'
  | 'type'
  | 'press'
  | 'hover'
  | 'scroll'
  | 'waitFor'
  | 'wait'
  | 'navigate'

export interface FlowStep {
  action: FlowActionKind
  /** CSS selector. Required for click/type/hover/waitFor, meaningless for the rest. */
  selector?: string
  /** Text to type, key to press, pixels to scroll, milliseconds to wait, URL to navigate. */
  value?: string
  /** What this step is called in the report. Defaults to a description of the action. */
  name?: string
  /**
   * Whether this step is measured on its own.
   *
   * Default true, and that default is the point: a flow whose steps are all measured
   * together reports one number for five interactions and cannot say which one was slow.
   * Turn it off for the plumbing — a cookie banner to dismiss, a field to fill before the
   * button that matters — so the report stays about the interactions worth reading.
   */
  measure?: boolean
}

export interface FlowDefinition {
  id:        string
  userId?:   string
  /** The site this belongs to, when it was created from one. */
  websiteId?: string | null
  name:      string
  /** Where the flow starts. Every flow opens with a cold navigation here. */
  url:       string
  steps:     FlowStep[]
  /** Audit the page as it is at the end, for the accessibility of whatever state the flow
   *  left behind. Cheap — a snapshot takes no timing — and usually the point of the flow. */
  snapshotAtEnd?: boolean
  formFactor?: 'mobile' | 'desktop'
  createdAt?: string
  updatedAt?: string
  /** Set by the API when listing: when this flow last ran, and how it went. */
  lastRun?:  { id: string; at: string; failedSteps: number } | null
}

/** The measurement modes, named as Lighthouse names them. */
export type FlowStepMode = 'navigation' | 'timespan' | 'snapshot'

/**
 * What one measured step produced.
 *
 * Everything past `mode` is optional because the modes genuinely differ — a timespan has no
 * LCP and a snapshot has no timing at all. A reader that assumes otherwise renders a
 * confident zero, which is the one thing a measuring tool must not do.
 */
export interface FlowStepResult {
  name:  string
  mode:  FlowStepMode
  /** Only the categories this mode actually scores. */
  scores: Partial<{ performance: number; accessibility: number; bestPractices: number; seo: number }>
  metrics: Partial<{ inp: number; tbt: number; cls: number; lcp: number; fcp: number; si: number; tti: number }>
  /** Failing audits, capped per category exactly as a navigation audit's are. */
  audits: FlowAuditItem[]
  /** What the step did, echoed back so a report reads without the definition beside it. */
  action?: string
}

/** Deliberately not `AuditItem`: a flow report shows far less per audit, and importing the
 *  analyzer's full item would drag element screenshots and savings into a document that
 *  never displays them. */
export interface FlowAuditItem {
  id:       string
  title:    string
  score:    number | null
  category?: string
  displayValue?: string
}

export interface FlowRunResult {
  id:        string
  flowId:    string
  name:      string
  url:       string
  formFactor: 'mobile' | 'desktop'
  timestamp: string
  steps:     FlowStepResult[]
  /** Wall clock for the whole flow, which is what a person waits for. */
  durationMs: number
}

/** How far along a running flow is — one step at a time, since that is how it runs. */
export interface FlowProgress {
  flowRunId: string
  /** 0-based index into the definition's steps; -1 while the opening navigation runs. */
  step:      number
  total:     number
  message:   string
  percent:   number
}

/**
 * Which metrics a mode reports.
 *
 * Shared because the server decides what to store and the client decides what to draw, and
 * a disagreement shows up as an empty cell that looks like a measurement of zero.
 */
export const FLOW_MODE_METRICS: Record<FlowStepMode, Array<keyof FlowStepResult['metrics']>> = {
  navigation: ['lcp', 'fcp', 'tbt', 'cls', 'si', 'tti'],
  timespan:   ['inp', 'tbt', 'cls'],
  snapshot:   [],
}

/** Which categories a mode scores. A snapshot reports a performance score of 0 — it has no
 *  timing to score — and showing that would be a lie about a page nobody measured. */
export const FLOW_MODE_CATEGORIES: Record<FlowStepMode, Array<keyof FlowStepResult['scores']>> = {
  navigation: ['performance', 'accessibility', 'bestPractices', 'seo'],
  timespan:   ['performance'],
  snapshot:   ['accessibility', 'bestPractices', 'seo'],
}

/** Steps a flow may hold. Past this it is a test suite, and it belongs in one. */
export const MAX_FLOW_STEPS = 20

/** How a step describes itself when it was not given a name. */
export function describeFlowStep(step: FlowStep): string {
  switch (step.action) {
    case 'click':    return `Click ${step.selector ?? ''}`.trim()
    case 'type':     return `Type into ${step.selector ?? ''}`.trim()
    case 'press':    return `Press ${step.value ?? ''}`.trim()
    case 'hover':    return `Hover ${step.selector ?? ''}`.trim()
    case 'scroll':   return step.value ? `Scroll ${step.value}px` : 'Scroll to the bottom'
    case 'waitFor':  return `Wait for ${step.selector ?? ''}`.trim()
    case 'wait':     return `Wait ${step.value ?? '1000'}ms`
    case 'navigate': return `Go to ${step.value ?? ''}`.trim()
    default:         return step.action
  }
}
