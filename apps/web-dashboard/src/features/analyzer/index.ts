/**
 * Public API of the analyzer feature. Running an analysis and rendering its result panels.
 *
 * Everything the outside world may use is exported here; ESLint bans reaching past
 * this file. Internals can move freely as long as these names keep resolving.
 */
export { TimelineProvider } from './model/TimelineContext';
export { useAnalysisStore } from './model/analysisStore';
export { useAnalysis } from './model/useAnalysis';
export { AnalyzerSearchForm } from './ui/AnalyzerSearchForm';
export { AskAboutAudit } from './ui/AskAboutAudit';
export type { AskSubject } from './ui/AskAboutAudit';
export { CLSVisualizer } from './ui/CLSVisualizer';
export { HeapMemoryChart } from './ui/HeapMemoryChart';
export { InteractionTimeline } from './ui/InteractionTimeline';
export { PerformanceTimeline } from './ui/PerformanceTimeline';
export { ResourceBreakdown } from './ui/ResourceBreakdown';
export { ResourceDependencyChain } from './ui/ResourceDependencyChain';
export { ResourceWaterfall } from './ui/ResourceWaterfall';
export { ResourcesAlert } from './ui/ResourcesAlert';
export { StreamingMetrics } from './ui/StreamingMetrics';
export { StreamingScores } from './ui/StreamingScores';
export { ThirdPartyPanel } from './ui/ThirdPartyPanel';
export { TimelineWaterfall } from './ui/TimelineWaterfall';
export { TimelineWaterfallSkeleton } from './ui/TimelineWaterfallSkeleton';
