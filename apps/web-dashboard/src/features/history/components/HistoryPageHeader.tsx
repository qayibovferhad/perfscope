import { useMemo } from 'react';
import { Globe, AlertTriangle, Download, FileText } from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import { isReg } from '@/features/history/lib/format';
import { exportJson, exportCsv } from '@/features/history/lib/export';
import { ScoreSparkline } from './ScoreSparkline';

interface Props {
  url:     string;
  entries: HistoryEntry[];
}

export function HistoryPageHeader({ url, entries }: Props) {
  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  const regCount = useMemo(() => {
    let n = 0;
    for (let i = 1; i < entries.length; i++) {
      if (isReg(entries[i].metrics.lcp, entries[i - 1].metrics.lcp) ||
          isReg(entries[i].metrics.tbt, entries[i - 1].metrics.tbt)) n++;
    }
    return n;
  }, [entries]);

  return (
    <div className="rounded-2xl overflow-hidden bg-ps-surface border border-ps-surface-border backdrop-blur-md">
      <div className="px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-ps-accent-muted border border-ps-accent-border">
            <Globe className="w-5 h-5 text-ps-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-ps-heading">{hostname}</h1>
              {regCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-ps-reg-muted border border-ps-reg-border text-ps-regression">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {regCount} regression{regCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5 font-mono truncate max-w-[420px] text-ps-faint">{url}</p>
            <p className="text-[10px] mt-1 text-ps-faint">
              {entries.length} run{entries.length !== 1 ? 's' : ''} tracked · max 10
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-ps-faint">Performance Score</span>
            <ScoreSparkline entries={entries} />
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => exportJson(entries, url)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ps-btn-ghost"
            >
              <Download className="w-3 h-3" /> Export JSON
            </button>
            <button
              onClick={() => exportCsv(entries, url)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ps-badge-amber"
            >
              <FileText className="w-3 h-3" /> Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
