/**
 * Public API of the history feature. Audit history — tables, tabs, trend forecast.
 *
 * Everything the outside world may use is exported here; ESLint bans reaching past
 * this file. Internals can move freely as long as these names keep resolving.
 */
export { computeRows } from './lib/computeRows';
export type { HistoryTab, SortKey, SortOrder, StatusFilter } from './model/types';
export { HistoryBreadcrumb } from './ui/HistoryBreadcrumb';
export { HistoryDeepDiveTable } from './ui/HistoryDeepDiveTable';
export { HistoryEmptyState } from './ui/HistoryEmptyState';
export { HistoryEvolutionCard } from './ui/HistoryEvolutionCard';
export { HistoryTabBar } from './ui/HistoryTabBar';
export { TrendForecastPanel } from './ui/TrendForecastPanel';
