import { motion } from 'framer-motion';
import { Clock, Maximize2, Layers, LayoutGrid, Zap, Timer } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { fmtMs, fmtSec, fmtCls } from '@/shared/lib/format';
import { VITAL_THRESHOLDS, type CoreWebVitals, type AiMetricNotes } from '@perfscope/shared';
import { vitalBand, BAND_TEXT, BAND_TILE, BAND_BAR } from '../lib';
import { goodThreshold } from '../glossary';
import { GlossaryTip } from './GlossaryTip';
import { AiNote } from '@/shared/ui/ai-card';

function clamp(v: number) { return Math.min(100, Math.max(0, v)); }

const VITALS = [
  { key: 'fcp' as const, abbr: 'FCP', label: 'First Contentful Paint',   icon: Clock,      fmt: fmtSec },
  { key: 'lcp' as const, abbr: 'LCP', label: 'Largest Contentful Paint', icon: Maximize2,  fmt: fmtSec },
  { key: 'tbt' as const, abbr: 'TBT', label: 'Total Blocking Time',      icon: Layers,     fmt: fmtMs },
  { key: 'cls' as const, abbr: 'CLS', label: 'Cumulative Layout Shift',  icon: LayoutGrid, fmt: fmtCls },
  { key: 'si'  as const, abbr: 'SI',  label: 'Speed Index',              icon: Zap,        fmt: fmtSec },
  { key: 'tti' as const, abbr: 'TTI', label: 'Time to Interactive',      icon: Timer,      fmt: fmtSec },
] as const;

interface Props {
  metrics: CoreWebVitals;
  /** Gemini's line on each vital that is not already good. Absent on stored results with no AI. */
  notes?: AiMetricNotes;
  /** A live audit is still waiting on the commentary. */
  aiPending?: boolean;
}

export function MetricsGrid({ metrics, notes, aiPending }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
      {VITALS.map(({ key, abbr, label, icon: Icon, fmt }) => {
        const value  = metrics[key];
        const status = vitalBand(key, value);
        const barW   = clamp(value / VITAL_THRESHOLDS[key].poor * 100);
        // Only the vitals the server chose to comment on hold a place while it writes:
        // a good vital gets no note, so showing it a skeleton would promise one that
        // never arrives. Every tile pulsing would also drown the numbers themselves.
        const note = notes?.[key];
        const notePending = Boolean(aiPending) && status !== 'good';

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
                  BAND_TILE[status],
                )}>
                  <Icon className="w-[15px] h-[15px]" />
                </span>
                {abbr}
                <GlossaryTip term={key} />
              </span>
              {/* Derived, so a threshold change in VITAL_THRESHOLDS cannot leave this lying. */}
              <span className="font-mono text-[11px] text-ld-text-3">{goodThreshold(key)}</span>
            </div>

            {/* Value */}
            <p className={cn('font-mono text-[26px] font-semibold tracking-[-0.02em]', BAND_TEXT[status])}>
              {fmt(value)}
            </p>

            {/* Full name */}
            <p className="text-[12.5px] text-ld-text-3 mt-[3px]">{label}</p>

            {/* Severity bar */}
            <div className="h-1 rounded-[3px] bg-ld-border mt-[14px] overflow-hidden">
              <motion.div
                className={cn('h-full rounded-[3px]', BAND_BAR[status])}
                initial={{ width: 0 }}
                animate={{ width: `${barW}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
              />
            </div>

            <AiNote text={note} pending={notePending && !note} className="mt-3" />
          </div>
        );
      })}
    </div>
  );
}
