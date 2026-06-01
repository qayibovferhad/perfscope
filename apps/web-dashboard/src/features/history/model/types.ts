import type { HistoryEntry } from '@/entities/history';

/** Top-level page tab. */
export type HistoryTab = 'analysis' | 'compare';

/** Status filter pill in the deep-dive table. */
export type StatusFilter = 'all' | 'regression' | 'improved' | 'stable';

/** Sortable column key. */
export type SortKey = 'date' | 'score' | 'lcp' | 'tbt' | 'cls' | 'fcp' | 'tti';

/** Sort direction. */
export type SortOrder = 'asc' | 'desc';

/** Computed status of a single audit row vs. the previous one. */
export type RowStatus = 'baseline' | 'regression' | 'improved' | 'stable';

/** One row of the deep-dive table — current entry + previous + classification. */
export interface RowData {
  entry:  HistoryEntry;
  prev:   HistoryEntry | null;
  status: RowStatus;
}
