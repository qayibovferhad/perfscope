import type { HistoryEntry } from '@/entities/history';
import type { RowData, RowStatus, SortKey, SortOrder } from '../model/types';
import { isReg, scoreVerdict } from './format';

/**
 * Convert a chronologically-sorted entry list into RowData, classifying each
 * row against its predecessor (regression / improved / stable / baseline).
 *
 * Both verdicts are deliberately hard to earn. Every threshold here lives in
 * `@perfscope/shared` next to the one the alerting backend uses: a run labelled a
 * regression in this table is one the user may also have been emailed about, and a table
 * that called a five-point wobble "Improved" taught them to stop reading the column.
 */
export function computeRows(entries: HistoryEntry[]): RowData[] {
  return entries.map((entry, i) => {
    const prev = i > 0 ? entries[i - 1] : null;
    let status: RowStatus = 'baseline';
    if (prev) {
      const verdict = scoreVerdict(entry.scores.performance, prev.scores.performance);
      if (
        verdict === 'regressed' ||
        isReg('lcp', entry.metrics.lcp, prev.metrics.lcp) ||
        isReg('tbt', entry.metrics.tbt, prev.metrics.tbt)
      )
        status = 'regression';
      else if (verdict === 'improved')
        status = 'improved';
      else
        status = 'stable';
    }
    return { entry, prev, status };
  });
}

/**
 * Pure sort over RowData by a sortable column.
 */
export function sortRows(rows: RowData[], key: SortKey, order: SortOrder): RowData[] {
  return [...rows].sort((a, b) => {
    let av = 0, bv = 0;
    if (key === 'date')  { av = new Date(a.entry.timestamp).getTime(); bv = new Date(b.entry.timestamp).getTime(); }
    if (key === 'score') { av = a.entry.scores.performance;  bv = b.entry.scores.performance; }
    if (key === 'lcp')   { av = a.entry.metrics.lcp;  bv = b.entry.metrics.lcp; }
    if (key === 'tbt')   { av = a.entry.metrics.tbt;  bv = b.entry.metrics.tbt; }
    if (key === 'cls')   { av = a.entry.metrics.cls;  bv = b.entry.metrics.cls; }
    if (key === 'fcp')   { av = a.entry.metrics.fcp;  bv = b.entry.metrics.fcp; }
    if (key === 'tti')   { av = a.entry.metrics.tti;  bv = b.entry.metrics.tti; }
    return order === 'asc' ? av - bv : bv - av;
  });
}
