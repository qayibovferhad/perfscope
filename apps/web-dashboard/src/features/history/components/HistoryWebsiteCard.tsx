import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowRight,
} from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import { EvolutionChart } from '@/features/history/components/RegressionHistory';

interface Props {
  siteUrl:  string;
  siteName: string;
  entries:  HistoryEntry[];
}

const fmtMs = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;

export function HistoryWebsiteCard({ siteUrl, siteName, entries }: Props) {
  const navigate = useNavigate();
  const [hov, setHov] = useState<number | null>(null);
  const hostname = (() => {
    try { return new URL(siteUrl).hostname; } catch { return siteUrl; }
  })();

  const latest = entries[entries.length - 1];
  const prev   = entries.length >= 2 ? entries[entries.length - 2] : null;
  const trend  = prev ? latest.scores.performance - prev.scores.performance : 0;

  const regCount = useMemo(() => {
    let n = 0;
    for (let i = 1; i < entries.length; i++) {
      const dp = (entries[i].metrics.lcp - entries[i - 1].metrics.lcp) / (entries[i - 1].metrics.lcp || 1) * 100;
      const dt = (entries[i].metrics.tbt - entries[i - 1].metrics.tbt) / (entries[i - 1].metrics.tbt || 1) * 100;
      if (dp > 15 || dt > 15) n++;
    }
    return n;
  }, [entries]);

  const trendColor =
    trend > 0 ? 'text-ps-healthy'
    : trend < 0 ? 'text-ps-regression'
    : 'text-ps-muted';

  return (
    <div className="rounded-2xl overflow-hidden bg-ps-surface border border-ps-surface-border backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-ps-divider">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-ps-accent-muted">
            <Globe className="w-4 h-4 text-ps-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-ps-heading">
              {siteName || hostname}
            </p>
            <p className="text-[10px] font-mono truncate text-ps-faint">{hostname}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-[22px] font-black tabular-nums leading-none text-ps-heading">
              {Math.round(latest.scores.performance)}
            </span>
            <span className={`text-[10px] flex items-center gap-0.5 ${trendColor}`}>
              {trend > 0 ? <TrendingUp className="w-3 h-3" />
                : trend < 0 ? <TrendingDown className="w-3 h-3" />
                : <Minus className="w-3 h-3" />}
              {trend !== 0 ? `${trend > 0 ? '+' : ''}${Math.round(trend)} pts` : 'stable'}
            </span>
          </div>

          {regCount > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-ps-reg-muted border border-ps-reg-border text-ps-regression">
              <AlertTriangle className="w-2.5 h-2.5" /> {regCount} regression{regCount > 1 ? 's' : ''}
            </span>
          )}

          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-ps-muted">
            {entries.length} run{entries.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-4 divide-x divide-ps-divider border-b border-ps-divider">
        {[
          { label: 'LCP', value: fmtMs(latest.metrics.lcp) },
          { label: 'TBT', value: fmtMs(latest.metrics.tbt) },
          { label: 'CLS', value: latest.metrics.cls.toFixed(3) },
          { label: 'FCP', value: fmtMs(latest.metrics.fcp) },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center py-3">
            <span className="text-[9px] font-bold uppercase tracking-widest mb-0.5 text-ps-faint">{label}</span>
            <span className="text-sm font-bold tabular-nums text-ps-heading">{value}</span>
          </div>
        ))}
      </div>

      {/* Evolution chart */}
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-center gap-4 mb-3">
          <span className="flex items-center gap-1.5 text-[9px] text-ps-muted">
            <span className="w-4 h-0.5 rounded-full bg-ps-accent shadow-glow-accent inline-block" /> LCP
          </span>
          <span className="flex items-center gap-1.5 text-[9px] text-ps-muted">
            <span className="w-4 h-0.5 rounded-full bg-ps-amber shadow-glow-amber inline-block" /> TBT
          </span>
          <span className="flex items-center gap-1.5 text-[9px] text-ps-muted">
            <span className="w-2.5 h-2.5 rounded-full border border-ps-regression shadow-glow-reg" /> Regression
          </span>
        </div>
        <EvolutionChart entries={entries} hoveredIdx={hov} onHover={setHov} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-ps-divider">
        <span className="text-[10px] text-ps-faint">
          Last run: {new Date(latest.timestamp).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
        <button
          onClick={() => navigate(`/history?url=${encodeURIComponent(siteUrl)}`)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all bg-ps-accent-muted text-ps-accent border border-ps-accent-border hover:bg-ps-accent-hover"
        >
          View Details <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
