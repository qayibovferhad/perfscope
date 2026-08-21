import type { HistoryEntry } from '@/entities/history';
import { getHostname } from '@/entities/website';
import { downloadBlob } from '@/shared/lib/download';

const hostnameOf = (url: string): string => getHostname(url, 'history');

export function exportJson(entries: HistoryEntry[], url: string): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `perfscope-history-${hostnameOf(url)}-${Date.now()}.json`);
}

export function exportCsv(entries: HistoryEntry[], url: string): void {
  const header = 'Date,Commit,Score,LCP(ms),TBT(ms),CLS,FCP(ms),TTI(ms)';
  const rows   = entries.map(e =>
    [new Date(e.timestamp).toISOString(), e.shortId, e.scores.performance,
     e.metrics.lcp, e.metrics.tbt, e.metrics.cls.toFixed(3), e.metrics.fcp, e.metrics.tti].join(','),
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  downloadBlob(blob, `perfscope-history-${hostnameOf(url)}-${Date.now()}.csv`);
}
