import { motion } from 'framer-motion';
import { Clock, Maximize2, Layers, LayoutGrid, Zap, Timer } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { fmtSec, fmtCls } from '@/shared/lib/format';
import { VITAL_THRESHOLDS, type CoreWebVitals } from '@perfscope/shared';
import { vitalBand, type ScoreBand } from '../lib';

function clamp(v: number) { return Math.min(100, Math.max(0, v)); }

const VITALS = [
  { key: 'fcp' as const, abbr: 'FCP', label: 'First Contentful Paint',   icon: Clock,      fmt: fmtSec, hint: 'good < 1.8s'   },
  { key: 'lcp' as const, abbr: 'LCP', label: 'Largest Contentful Paint', icon: Maximize2,  fmt: fmtSec, hint: 'good < 2.5s'   },
  { key: 'tbt' as const, abbr: 'TBT', label: 'Total Blocking Time',      icon: Layers,     fmt: (v: number) => `${Math.round(v)}ms`, hint: 'good < 200ms' },
  { key: 'cls' as const, abbr: 'CLS', label: 'Cumulative Layout Shift',  icon: LayoutGrid, fmt: fmtCls, hint: 'good < 0.1'    },
  { key: 'si'  as const, abbr: 'SI',  label: 'Speed Index',              icon: Zap,        fmt: fmtSec, hint: 'good < 3.4s'   },
  { key: 'tti' as const, abbr: 'TTI', label: 'Time to Interactive',      icon: Timer,      fmt: fmtSec, hint: 'good < 3.8s'   },
] as const;

const VAL_COLOR: Record<ScoreBand, string> = {
  good: 'text-[var(--ld-score-good)]',
  warn: 'text-[var(--ld-amber)]',
  poor: 'text-[var(--ld-rose)]',
};

const TILE_CLS: Record<ScoreBand, string> = {
  good: 'text-[var(--ld-accent)] border-[var(--ld-accent-line)] bg-[var(--ld-accent-soft)]',
  warn: 'text-[var(--ld-amber)] border-[rgba(230,162,60,.3)] bg-[rgba(230,162,60,.1)]',
  poor: 'text-[var(--ld-rose)] border-[rgba(242,100,122,.3)] bg-[rgba(242,100,122,.08)]',
};

const BAR_CLS: Record<ScoreBand, string> = {
  good: 'bg-[var(--ld-accent)]',
  warn: 'bg-[var(--ld-amber)]',
  poor: 'bg-[var(--ld-rose)]',
};

export function MetricsGrid({ metrics }: { metrics: CoreWebVitals }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
      {VITALS.map(({ key, abbr, label, icon: Icon, fmt, hint }) => {
        const value  = metrics[key];
        const status = vitalBand(key, value);
        const barW   = clamp(value / VITAL_THRESHOLDS[key].poor * 100);

        return (
          <div
            key={key}
            className="rounded-[14px] border border-ld-border bg-ld-surface p-[18px] transition-all duration-200 hover:-translate-y-[2px] hover:border-ld-accent-line"
          >
            {/* Top row */}
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ld-text-2">
                <span className={cn(
                  'w-[28px] h-[28px] rounded-[8px] grid place-items-center border',
                  TILE_CLS[status],
                )}>
                  <Icon className="w-[15px] h-[15px]" />
                </span>
                {abbr}
              </span>
              <span className="font-mono text-[11px] text-ld-text-3">{hint}</span>
            </div>

            {/* Value */}
            <p className={cn('font-mono text-[26px] font-semibold tracking-[-0.02em]', VAL_COLOR[status])}>
              {fmt(value)}
            </p>

            {/* Full name */}
            <p className="text-[12.5px] text-ld-text-3 mt-[3px]">{label}</p>

            {/* Severity bar */}
            <div className="h-1 rounded-[3px] bg-ld-border mt-[14px] overflow-hidden">
              <motion.div
                className={cn('h-full rounded-[3px]', BAR_CLS[status])}
                initial={{ width: 0 }}
                animate={{ width: `${barW}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
