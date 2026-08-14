import { useMemo } from 'react';
import { CompareSection, SectionHead } from './CompareSection';
import { SIDE_TEXT, SIDE_LABEL, sideOf } from './sides';
import { motion } from 'framer-motion';
import { Zap, Trophy, AlertTriangle, TrendingUp } from 'lucide-react';
import { VITAL_THRESHOLDS } from '@/entities/analysis';
import type { AnalysisResult, CoreWebVitals } from '@/entities/analysis';
import { fmtMs, fmtCls } from '@/shared/lib/format';

// ─── Metric meta ──────────────────────────────────────────────────────────────

const METRIC_META: { key: keyof CoreWebVitals; label: string; fmt: (v: number) => string }[] = [
  { key: 'lcp', label: 'LCP',         fmt: fmtMs  },
  { key: 'fcp', label: 'FCP',         fmt: fmtMs  },
  { key: 'tbt', label: 'TBT',         fmt: fmtMs  },
  { key: 'tti', label: 'TTI',         fmt: fmtMs  },
  { key: 'si',  label: 'Speed Index', fmt: fmtMs  },
  { key: 'cls', label: 'CLS',         fmt: fmtCls },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalise(value: number, good: number, poor: number): number {
  if (value <= good) return 100;
  if (value >= poor) return 0;
  return Math.round(100 * (poor - value) / (poor - good));
}

function bundleMB(result: AnalysisResult): number | null {
  const bytes = result.resources?.summary.total.transferSize;
  return bytes ? bytes / 1_048_576 : null;
}

function efficiencyScore(result: AnalysisResult): number | null {
  const mb = bundleMB(result);
  return mb ? +(result.scores.performance / mb).toFixed(2) : null;
}

function metricRatio(tVal: number, cVal: number): { ratio: number; winner: 'target' | 'competitor' | 'tied' } {
  if (tVal === cVal) return { ratio: 1, winner: 'tied' };
  const winner = tVal < cVal ? 'target' : 'competitor';
  const better = Math.min(tVal, cVal);
  const worse  = Math.max(tVal, cVal);
  return { ratio: better < 1 ? 1 : +(worse / better).toFixed(2), winner };
}

// ─── Section head helper ──────────────────────────────────────────────────────


// ─── Efficiency section (spec-exact) ─────────────────────────────────────────

function EfficiencySection({ target, competitor }: { target: AnalysisResult; competitor: AnalysisResult }) {
  const tEff = efficiencyScore(target);
  const cEff = efficiencyScore(competitor);
  const tMB  = bundleMB(target);
  const cMB  = bundleMB(competitor);

  if (!tEff && !cEff) return null;

  const maxEff = Math.max(tEff ?? 0, cEff ?? 0);
  const tW     = tEff ? (tEff / maxEff) * 100 : 0;
  const cW     = cEff ? (cEff / maxEff) * 100 : 0;
  const tWins  = (tEff ?? 0) >= (cEff ?? 0);
  const ratio  = tEff && cEff
    ? (Math.max(tEff, cEff) / Math.min(tEff, cEff)).toFixed(2)
    : null;

  return (
    <div className="mb-[22px]">
      {/* You bar */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold mb-2 text-ld-accent-2">
          <span className="w-[9px] h-[9px] rounded-full bg-ld-accent shrink-0" />
          Your Site
          {tMB && (
            <span className="font-mono text-[10.5px] text-ld-text-3 font-normal">
              ({tMB.toFixed(2)} MB)
            </span>
          )}
          <span className="ml-auto font-mono text-[12px]">
            {tEff ? `${tEff} pts/MB` : 'N/A'}
          </span>
        </div>
        <div className="h-4 rounded-[8px] bg-ld-border overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${tW}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="h-full rounded-[8px] bg-gradient-to-r from-ld-accent-soft to-ld-accent"
          />
        </div>
      </div>

      {/* Rival bar */}
      <div>
        <div className="flex items-center gap-2 text-[13px] font-semibold mb-2 text-ld-amber">
          <span className="w-[9px] h-[9px] rounded-full bg-ld-amber shrink-0" />
          Competitor
          {cMB && (
            <span className="font-mono text-[10.5px] text-ld-text-3 font-normal">
              ({cMB.toFixed(2)} MB)
            </span>
          )}
          <span className="ml-auto font-mono text-[12px]">
            {cEff ? `${cEff} pts/MB` : 'N/A'}
          </span>
        </div>
        <div className="h-4 rounded-[8px] bg-ld-border overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${cW}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.05 }}
            className="h-full rounded-[8px] bg-gradient-to-r from-[rgba(230,162,60,0.13)] to-ld-amber"
          />
        </div>
      </div>

      {/* Insight note */}
      {ratio && (
        <div className={`flex items-center gap-[11px] mt-5 px-4 py-[14px] rounded-[12px] text-[13.5px] text-ld-text-2 leading-[1.5]
          ${tWins
            ? 'bg-ld-accent-soft border border-ld-accent-line'
            : 'bg-[rgba(230,162,60,0.13)] border border-[rgba(230,162,60,0.34)]'}`}
        >
          <Trophy className={`w-[18px] h-[18px] shrink-0 ${SIDE_TEXT[sideOf(tWins)]}`} />
          <span>
            <b className={`font-bold ${SIDE_TEXT[sideOf(tWins)]}`}>
              {SIDE_LABEL[sideOf(tWins)]} is {ratio}× more efficient
            </b>
            {' '}per MB of resources delivered —{' '}
            {tWins
              ? 'you ship far less weight for the experience you provide.'
              : 'the competitor delivers more performance per MB transferred.'}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Normalised metrics ────────────────────────────────────────────────────────

type NormRowData = {
  key: string; label: string; tVal: number; cVal: number;
  tNorm: number; cNorm: number; ratio: number;
  winner: 'target' | 'competitor' | 'tied';
  isGap: boolean; fmt: (v: number) => string;
};

function NormRow({ row, index }: { row: NormRowData; index: number }) {
  const tWins = row.winner === 'target';
  const cWins = row.winner === 'competitor';
  const maxN  = Math.max(row.tNorm, row.cNorm, 1);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay: index * 0.045 }}
      className={[
        'grid items-center gap-3 px-3 py-[10px] rounded-[10px] transition-colors cursor-default',
        'grid-cols-[100px_56px_1fr_56px_110px]',
        row.isGap
          ? 'bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.28)] hover:bg-[rgba(239,68,68,0.12)]'
          : 'bg-ld-surface-2/50 border border-transparent hover:bg-ld-surface-2',
      ].join(' ')}
    >
      {/* Metric name */}
      <div className="flex items-center gap-[6px]">
        {row.isGap && <AlertTriangle className="w-[10px] h-[10px] shrink-0 text-ld-rose" />}
        <span className={`text-[11px] font-bold ${row.isGap ? 'text-ld-rose' : 'text-ld-text-2'}`}>
          {row.label}
        </span>
      </div>

      {/* You score */}
      <span className={`text-[12px] font-black tabular-nums text-right tracking-[0.01em]
        ${tWins ? 'text-ld-accent-2' : 'text-ld-text-3'}`}>
        {row.tNorm}
      </span>

      {/* Split bar */}
      <div className="relative h-2 rounded-full overflow-hidden bg-ld-border">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(row.tNorm / maxN) * 50}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.04 }}
          className={`absolute left-0 top-0 h-full rounded-l-full
            ${tWins ? 'bg-gradient-to-r from-ld-accent-soft to-ld-accent' : 'bg-ld-accent/20'}`}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(row.cNorm / maxN) * 50}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.04 }}
          className={`absolute right-0 top-0 h-full rounded-r-full
            ${cWins
              ? 'bg-gradient-to-l from-[rgba(230,162,60,0.3)] to-ld-amber'
              : 'bg-ld-amber/20'}`}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-px bg-ld-border-strong" />
      </div>

      {/* Rival score */}
      <span className={`text-[12px] font-black tabular-nums tracking-[0.01em]
        ${cWins ? 'text-ld-amber' : 'text-ld-text-3'}`}>
        {row.cNorm}
      </span>

      {/* Delta badge */}
      <div className="flex justify-end">
        {row.isGap ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-[4px] rounded-[7px] whitespace-nowrap text-ld-rose bg-[rgba(239,68,68,0.18)] border border-[rgba(239,68,68,0.50)]">
            <Zap className="w-[9px] h-[9px] shrink-0" />
            {row.ratio}× Gap
          </span>
        ) : row.winner !== 'tied' ? (
          <span className={`text-[9px] font-semibold px-[7px] py-[3px] rounded-[6px] whitespace-nowrap
            ${tWins
              ? 'text-ld-accent-2 bg-ld-accent-soft border border-ld-accent-line'
              : 'text-ld-amber bg-[rgba(230,162,60,0.13)] border border-[rgba(230,162,60,0.34)]'}`}>
            {tWins ? 'You' : 'Rival'} +{Math.round(Math.abs(row.tNorm - row.cNorm))}pts
          </span>
        ) : (
          <span className="text-[9px] text-ld-text-3">Tied</span>
        )}
      </div>
    </motion.div>
  );
}

function NormalisedMetrics({ target, competitor }: { target: AnalysisResult; competitor: AnalysisResult }) {
  const rows = useMemo(() => METRIC_META.map(({ key, label, fmt }) => {
    const th     = VITAL_THRESHOLDS[key];
    const tVal   = target.metrics[key];
    const cVal   = competitor.metrics[key];
    const tNorm  = normalise(tVal, th.good, th.poor);
    const cNorm  = normalise(cVal, th.good, th.poor);
    const { ratio, winner } = metricRatio(tVal, cVal);
    return { key, label, tVal, cVal, tNorm, cNorm, ratio, winner, isGap: ratio >= 2 && winner !== 'tied', fmt };
  }), [target, competitor]);

  return (
    <div className="pt-[22px] border-t border-ld-border">
      <SectionHead icon={<TrendingUp className="w-[16px] h-[16px]" />} title="Normalised Metrics" />

      {/* Table header */}
      <div className="grid grid-cols-[100px_56px_1fr_56px_110px] gap-3 px-3 pb-[10px] mb-1">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-ld-text-3">Metric</span>
        <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-ld-accent-2 text-right">You</span>
        <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-ld-text-3 text-center">Score 0–100</span>
        <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-ld-amber">Rival</span>
        <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-ld-text-3 text-right">Delta</span>
      </div>

      <div className="space-y-[3px]">
        {rows.map((row, i) => <NormRow key={row.key} row={row} index={i} />)}
      </div>

      <p className="mt-3 text-[10px] text-ld-text-3">
        Score = (poor − value) ÷ (poor − good) × 100, clamped 0–100 per Google Web Vitals thresholds.
      </p>
    </div>
  );
}

// ─── Gaps callout ─────────────────────────────────────────────────────────────

function GapsCallout({ target, competitor }: { target: AnalysisResult; competitor: AnalysisResult }) {
  const gaps = useMemo(() => METRIC_META.map(({ key, label, fmt }) => {
    const tVal = target.metrics[key];
    const cVal = competitor.metrics[key];
    const { ratio, winner } = metricRatio(tVal, cVal);
    if (ratio < 2 || winner === 'tied') return null;
    return { key, label, tVal, cVal, ratio, winner, fmt };
  }).filter(Boolean) as { key: string; label: string; tVal: number; cVal: number; ratio: number; winner: 'target' | 'competitor'; fmt: (v: number) => string }[], [target, competitor]);

  if (!gaps.length) return null;

  return (
    <div className="pt-[22px] mt-[22px] border-t border-ld-border">
      <SectionHead
        icon={<AlertTriangle className="w-[16px] h-[16px]" />}
        title={`Performance Gaps — ${gaps.length} metric${gaps.length > 1 ? 's' : ''} with ≥ 2× advantage`}
      />
      <div className="space-y-3">
        {gaps.map((gap, i) => {
          const tWins   = gap.winner === 'target';
          const better  = tWins ? gap.tVal : gap.cVal;
          const worse   = tWins ? gap.cVal : gap.tVal;
          const betterW = (better / (better + worse)) * 100;
          const worseW  = (worse  / (better + worse)) * 100;

          return (
            <motion.div
              key={gap.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="rounded-[12px] px-4 py-[14px] space-y-[10px] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.30)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-[14px] h-[14px] text-ld-rose shrink-0" />
                  <span className="text-[12px] font-bold text-ld-text">{gap.label}</span>
                  <span className={`text-[9px] font-bold px-[7px] py-[3px] rounded-[6px]
                    ${tWins
                      ? 'text-ld-accent-2 bg-ld-accent-soft border border-ld-accent-line'
                      : 'text-ld-amber bg-[rgba(230,162,60,0.13)] border border-[rgba(230,162,60,0.34)]'}`}>
                    {tWins ? 'You win' : 'Rival wins'}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-black text-ld-rose">
                  {gap.ratio}× faster
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`font-mono text-[10px] font-bold tabular-nums w-14 text-right
                  ${tWins ? 'text-ld-text' : 'text-ld-text-3'}`}>
                  {gap.fmt(gap.tVal)}
                </span>
                <div className="flex flex-1 items-center h-[10px]">
                  <div className="flex-1 flex justify-end overflow-hidden h-full rounded-l-full bg-ld-border">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${tWins ? betterW : worseW}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.06 }}
                      className={`h-full rounded-l-full
                        ${tWins
                          ? 'bg-gradient-to-l from-ld-accent-soft to-ld-accent'
                          : 'bg-ld-accent/20'}`}
                    />
                  </div>
                  <div className="w-[1.5px] h-[16px] shrink-0 bg-ld-border-strong" />
                  <div className="flex-1 flex justify-start overflow-hidden h-full rounded-r-full bg-ld-border">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${!tWins ? betterW : worseW}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.06 }}
                      className={`h-full rounded-r-full
                        ${!tWins
                          ? 'bg-gradient-to-r from-[rgba(230,162,60,0.3)] to-ld-amber'
                          : 'bg-ld-amber/20'}`}
                    />
                  </div>
                </div>
                <span className={`font-mono text-[10px] font-bold tabular-nums w-14
                  ${!tWins ? 'text-ld-text' : 'text-ld-text-3'}`}>
                  {gap.fmt(gap.cVal)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ComparisonEngine({
  target, competitor,
}: {
  target: AnalysisResult; competitor: AnalysisResult;
}) {
  return (
    <CompareSection icon={<Zap />} title="Comparison Engine" badge="Efficiency score">
      <EfficiencySection target={target} competitor={competitor} />
      <NormalisedMetrics target={target} competitor={competitor} />
      <GapsCallout       target={target} competitor={competitor} />
    </CompareSection>
  );
}
