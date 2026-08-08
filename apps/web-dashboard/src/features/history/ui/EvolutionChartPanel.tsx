import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, GitCommit, Info } from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import { EvolutionChart, isRegression } from './EvolutionChart';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function deltaPct(curr: number, prev: number) {
  return !prev ? 0 : ((curr - prev) / prev) * 100;
}

// ─── Hover Tooltip ────────────────────────────────────────────────────────────

function HoverTooltip({ entry, prev }: { entry: HistoryEntry; prev: HistoryEntry | null }) {
  const regLcp = prev ? isRegression(entry.metrics.lcp, prev.metrics.lcp) : false;
  const regTbt = prev ? isRegression(entry.metrics.tbt, prev.metrics.tbt) : false;

  const rows = [
    { label: 'LCP',   val: entry.metrics.lcp,           prevVal: prev?.metrics.lcp,           color: 'var(--ld-accent)', fmt: fmtMs },
    { label: 'TBT',   val: entry.metrics.tbt,           prevVal: prev?.metrics.tbt,           color: 'var(--ld-amber)',  fmt: fmtMs },
    { label: 'FCP',   val: entry.metrics.fcp,           prevVal: prev?.metrics.fcp,           color: 'var(--ld-text-2)', fmt: fmtMs },
    { label: 'Score', val: entry.scores.performance,    prevVal: prev?.scores.performance,    color: 'var(--ld-accent-2)', fmt: (v: number) => `${Math.round(v)}` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.14 }}
      className="rounded-[14px] px-[16px] py-[14px] text-[11px] space-y-[10px] min-w-[200px]"
      style={{ background: 'var(--ld-surface-2)', border: '1px solid var(--ld-border-strong)' }}
    >
      {/* Commit + date */}
      <div className="flex items-center gap-[8px]">
        <GitCommit className="w-[12px] h-[12px] text-ld-text-3 shrink-0" />
        <span className="font-mono font-bold text-ld-text-2">#{entry.shortId}</span>
        <span className="text-ld-text-3">{fmtDate(entry.timestamp)}</span>
      </div>

      {/* Regression badge */}
      {(regLcp || regTbt) && (
        <div className="flex items-center gap-[6px] px-[10px] py-[6px] rounded-[8px] bg-[rgba(242,100,122,0.10)] border border-[rgba(242,100,122,0.28)]">
          <AlertTriangle className="w-[11px] h-[11px] text-ld-rose shrink-0" />
          <span className="text-ld-rose font-bold text-[10px]">Regression Detected</span>
        </div>
      )}

      {/* Metric rows */}
      <div className="space-y-[6px]">
        {rows.map(({ label, val, prevVal, color, fmt }) => {
          const pct = prevVal !== undefined ? deltaPct(val, prevVal) : null;
          return (
            <div key={label} className="flex items-center justify-between gap-[16px]">
              <span className="flex items-center gap-[6px] text-ld-text-3">
                <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: color }} />
                {label}
              </span>
              <span className="flex items-center gap-[8px] font-mono">
                <span className="text-ld-text">{fmt(val)}</span>
                {pct !== null && (
                  <span className={`text-[9px] ${pct > 15 ? 'text-ld-rose' : pct < -5 ? 'text-ld-accent-2' : 'text-ld-text-3'}`}>
                    {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Title + regression badge + legend + chart + hover tooltip.
 *
 * Shared so the website card on the history overview and the per-URL drill-down render
 * the identical panel — they used to wrap the same EvolutionChart in two different,
 * hand-rolled legends built on different token families.
 */
export function EvolutionChartPanel({ entries }: { entries: HistoryEntry[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasRegression = useMemo(() => {
    for (let i = 1; i < entries.length; i++) {
      if (
        isRegression(entries[i]!.metrics.lcp, entries[i - 1]!.metrics.lcp) ||
        isRegression(entries[i]!.metrics.tbt, entries[i - 1]!.metrics.tbt)
      ) return true;
    }
    return false;
  }, [entries]);

  const hoveredEntry = hoveredIdx !== null ? entries[hoveredIdx] ?? null : null;
  const hoveredPrev  = hoveredIdx !== null && hoveredIdx > 0 ? entries[hoveredIdx - 1] ?? null : null;

  return (
    <div className="px-[24px] py-[22px]">

      {/* Title row */}
      <div className="flex items-center justify-between gap-[12px] mb-[14px] flex-wrap">
        <h3 className="font-mono text-[12px] tracking-[.10em] uppercase text-ld-text-2 font-semibold flex items-center gap-[8px]">
          <TrendingUp className="w-[15px] h-[15px] text-ld-accent" />
          Performance Evolution
        </h3>
        {hasRegression && (
          <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold text-ld-rose px-[11px] py-[5px] rounded-full border border-[rgba(242,100,122,0.3)] bg-[rgba(242,100,122,0.08)]">
            <AlertTriangle className="w-[13px] h-[13px]" />
            Regression Detected
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-[18px] mb-[16px] flex-wrap">
        <span className="inline-flex items-center gap-[8px] font-mono text-[11.5px] text-ld-text-3">
          <i className="w-[16px] h-[3px] rounded-sm bg-ld-accent block not-italic" />
          LCP
        </span>
        <span className="inline-flex items-center gap-[8px] font-mono text-[11.5px] text-ld-text-3">
          <i className="w-[16px] h-[3px] rounded-sm bg-ld-amber block not-italic" />
          TBT
        </span>
        <span className="inline-flex items-center gap-[8px] font-mono text-[11.5px] text-ld-text-3">
          <i className="w-[10px] h-[10px] rounded-full border-2 border-ld-rose bg-[rgba(242,100,122,0.25)] block not-italic" />
          Regression
        </span>
        <span className="ml-auto inline-flex items-center gap-[5px] text-[10px] text-ld-text-3 opacity-60">
          <Info className="w-[11px] h-[11px]" /> Hover a point to inspect
        </span>
      </div>

      {/* SVG chart + floating tooltip */}
      <div className="relative">
        <EvolutionChart
          entries={entries}
          hoveredIdx={hoveredIdx}
          onHover={setHoveredIdx}
        />

        <AnimatePresence>
          {hoveredEntry && (
            <div className="absolute top-[8px] right-0 z-20 pointer-events-none">
              <HoverTooltip entry={hoveredEntry} prev={hoveredPrev} />
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
