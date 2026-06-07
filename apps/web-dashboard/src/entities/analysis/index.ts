/**
 * Analysis entity — Lighthouse audit domain types and helpers.
 * Source of truth lives in @perfscope/shared (consumed by backend, web, and extension).
 */
export type {
  AnalysisResult,
  AnalysisProgress,
  AnalysisStage,
  AnalysisCategory,
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
} from '@perfscope/shared'

export { rateScore, rateLcp, rateCls, rateTbt } from '@perfscope/shared'
export type { ScoreRating } from '@perfscope/shared'

export { scoreColor, SCORE_GOOD, SCORE_WARN, SCORE_BAD } from './lib'

export { ScoreCard, ScoreCardSkeleton, type ScoreLabel } from './ui/ScoreCard'
export { MetricsGrid } from './ui/MetricsGrid'
export { AuditList } from './ui/AuditList'
