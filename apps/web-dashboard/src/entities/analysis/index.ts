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
  MeasurementQuality,
  ThirdPartyEntity,
} from '@perfscope/shared'

export { rateScore, rateVital, rateLcp, rateCls, rateTbt, VITAL_THRESHOLDS } from '@perfscope/shared'
export type { ScoreRating, VitalKey, AuditFormFactor } from '@perfscope/shared'

export { scoreColor, scoreBand, vitalBand, SCORE_GOOD, SCORE_WARN, SCORE_BAD } from './lib'
export type { ScoreBand } from './lib'

export { ScoreCard, ScoreCardSkeleton, type ScoreLabel } from './ui/ScoreCard'
export { MetricsGrid } from './ui/MetricsGrid'
export { AuditList } from './ui/AuditList'
export { ProgressStepper } from './ui/ProgressStepper'

export { startAnalysis, joinAnalysis, emitAuthAuditStart } from './api/analysisSocket'
export type { AnalysisCallbacks, AuditPrecision, StartAnalysisOptions } from './api/analysisSocket'

export { usePrefetchStore } from './model/prefetchStore'
export type { PrefetchPartialMap } from './model/prefetchStore'
export { useAuditModeStore } from './model/auditModeStore'
