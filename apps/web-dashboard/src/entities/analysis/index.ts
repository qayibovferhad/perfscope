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
  AnalysisInsightsPayload,
  PreviousRunSummary,
  ResourceDiff,
  ResourceResize,
  DiffableResource,
} from '@perfscope/shared'

export { rateScore, rateVital, rateLcp, rateCls, rateTbt, VITAL_THRESHOLDS, SCORE_BANDS } from '@perfscope/shared'
export type { ScoreRating, VitalKey, AuditFormFactor, AuditPrecision } from '@perfscope/shared'

export {
  scoreColor, scoreBand, vitalBand, deltaOf, findFrameAt, findClosestFrameIndex, mergeAnalysisInsights, SCORE_GOOD, SCORE_WARN, SCORE_BAD,
  BAND_TEXT, BAND_STROKE, BAND_TILE, BAND_BORDER, BAND_BAR, BAND_LABEL,
} from './lib'
export { FIELD_METRICS, FIELD_METRIC_ORDER, RATING_TEXT, RATING_LABEL } from './fieldMetrics'
export { RESOURCE_TYPES, resourceBadgeStyle } from './resourceTypes'
export type { ResourceTypeMeta } from './resourceTypes'
export { GLOSSARY, thresholdLine, goodThreshold, CATEGORY_BAND_LINE, isVitalKey } from './glossary'
export type { GlossaryKey, CategoryKey } from './glossary'
export { GlossaryTip } from './ui/GlossaryTip'
export type { FieldMetricKey } from './fieldMetrics'
export type { ScoreBand, PartialMap, Delta, DeltaKind } from './lib'

export { ScoreCard, ScoreCardSkeleton, type ScoreLabel } from './ui/ScoreCard'
export { DeltaBadge } from './ui/DeltaBadge'
export { MetricsGrid } from './ui/MetricsGrid'
export { AuditList } from './ui/AuditList'
export { ProgressStepper } from './ui/ProgressStepper'
export { ElapsedClock, formatElapsed } from './ui/ElapsedClock'
export { ScoreRing } from './ui/ScoreRing'
export { FormFactorToggle, DEVICE_MODES } from './ui/FormFactorToggle'
export { AvgBadge } from './ui/AvgBadge'
export { PrecisionToggle, PRECISION_MODES } from './ui/PrecisionToggle'

export { startAnalysis, joinAnalysis, emitAuthAuditStart, attachAnalysisListeners, cancelAnalysis } from './api/analysisSocket'
export type { AnalysisCallbacks, StartAnalysisOptions } from './api/analysisSocket'

export { usePrefetchStore } from './model/prefetchStore'
export type { PrefetchPartialMap } from './model/prefetchStore'
export { useAuditModeStore } from './model/auditModeStore'

export { METRIC_MARKERS } from './metricMarkers'
export type { MarkerVital } from './metricMarkers'
