import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap, Trophy, AlertTriangle, TrendingUp } from 'lucide-react';
import type { AnalysisResult, CoreWebVitals } from '../../analyzer/types';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  background:     'rgba(17,24,39,0.72)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border:         '1px solid rgba(255,255,255,0.10)',
  borderRadius:   '1rem',
  overflow:       'hidden',
};

const DIVIDER = 'rgba(255,255,255,0.08)';
const T_HEX   = '#8B5CF6';
const C_HEX   = '#F59E0B';
const T_GLOW  = 'rgba(139,92,246,0.55)';
const C_GLOW  = 'rgba(245,158,11,0.55)';
const GAP_CLR = '#ef4444';

// ─── Thresholds (web.dev standards) ──────────────────────────────────────────

const THRESHOLDS: Record<keyof CoreWebVitals, { good: number; poor: number }> = {
  fcp: { good: 1800,  poor: 3000  },
  lcp: { good: 2500,  poor: 4000  },
  tbt: { good: 200,   poor: 600   },
  cls: { good: 0.1,   poor: 0.25  },
  si:  { good: 3400,  poor: 5800  },
  tti: { good: 3800,  poor: 7300  },
};

const METRIC_META: { key: keyof CoreWebVitals; label: string; unit: string; fmt: (v: number) => string }[] = [
  { key: 'lcp', label: 'LCP',          unit: 'ms',  fmt: v => `${(v/1000).toFixed(2)}s`  },
  { key: 'fcp', label: 'FCP',          unit: 'ms',  fmt: v => `${(v/1000).toFixed(2)}s`  },
  { key: 'tbt', label: 'TBT',          unit: 'ms',  fmt: v => `${Math.round(v)}ms`        },
  { key: 'tti', label: 'TTI',          unit: 'ms',  fmt: v => `${(v/1000).toFixed(2)}s`  },
  { key: 'si',  label: 'Speed Index',  unit: 'ms',  fmt: v => `${(v/1000).toFixed(2)}s`  },
  { key: 'cls', label: 'CLS',          unit: '',    fmt: v => v.toFixed(3)               },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 0–100 normalised score (lower-is-better metrics) */
function normalise(value: number, good: number, poor: number): number {
  if (value <= good) return 100;
  if (value >= poor) return 0;
  return Math.round(100 * (poor - value) / (poor - good));
}

function bundleMB(result: AnalysisResult): number | null {
  const bytes = result.resources?.summary.total.transferSize;
  if (!bytes) return null;
  return bytes / 1_048_576;
}

/** Performance efficiency: Lighthouse score / bundle size (pts per MB) */
function efficiencyScore(result: AnalysisResult): number | null {
  const mb = bundleMB(result);
  if (!mb) return null;
  return +(result.scores.performance / mb).toFixed(2);
}

/** Ratio between two values (always > 1, lower-is-better assumed) */
function metricRatio(tVal: number, cVal: number): { ratio: number; winner: 'target' | 'competitor' | 'tied' } {
  if (tVal === cVal) return { ratio: 1, winner: 'tied' };
  const winner = tVal < cVal ? 'target' : 'competitor';
  const better = Math.min(tVal, cVal);
  const worse  = Math.max(tVal, cVal);
  const ratio  = better < 1 ? 1 : +(worse / better).toFixed(2);
  return { ratio, winner };
}

// ─── Sub-section header ───────────────────────────────────────────────────────

function SectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div
      className="flex items-center gap-2 px-6 py-3"
      style={{ borderBottom: `1px solid ${DIVIDER}`, background: 'rgba(255,255,255,0.012)' }}
    >
      <span style={{ color: '#64748b' }}>{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>{title}</span>
      {sub && <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>{sub}</span>}
    </div>
  );
}

// ─── Efficiency Score section ─────────────────────────────────────────────────

function EfficiencySection({ target, competitor }: { target: AnalysisResult; competitor: AnalysisResult }) {
  const tEff  = efficiencyScore(target);
  const cEff  = efficiencyScore(competitor);
  const tMB   = bundleMB(target);
  const cMB   = bundleMB(competitor);

  if (!tEff && !cEff) return null;

  const maxEff   = Math.max(tEff ?? 0, cEff ?? 0);
  const tW       = tEff ? (tEff / maxEff) * 100 : 0;
  const cW       = cEff ? (cEff / maxEff) * 100 : 0;
  const tWins    = (tEff ?? 0) >= (cEff ?? 0);
  const ratio    = tEff && cEff ? (Math.max(tEff, cEff) / Math.min(tEff, cEff)).toFixed(2) : null;

  return (
    <div>
      <SectionHeader
        icon={<Zap className="w-3.5 h-3.5" />}
        title="Efficiency Score"
        sub="Lighthouse performance per MB of transferred resources"
      />
      <div className="px-6 py-5 space-y-4">
        {/* Your Site bar */}
        <EfficencyBar
          label="Your Site" color={T_HEX} glow={T_GLOW}
          score={tEff} mb={tMB} barW={tW} isWinner={tWins}
          delay={0}
        />
        {/* Competitor bar */}
        <EfficencyBar
          label="Competitor" color={C_HEX} glow={C_GLOW}
          score={cEff} mb={cMB} barW={cW} isWinner={!tWins}
          delay={0.05}
        />

        {/* Winner callout */}
        {ratio && (
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 mt-2"
            style={{
              background: `${tWins ? T_HEX : C_HEX}12`,
              border:     `1px solid ${tWins ? T_HEX : C_HEX}35`,
            }}
          >
            <Trophy className="w-4 h-4 shrink-0 text-amber-400" />
            <p className="text-[11px] font-semibold" style={{ color: '#cbd5e1' }}>
              <span style={{ color: tWins ? T_HEX : C_HEX }}>
                {tWins ? 'Your Site' : 'Competitor'}
              </span>
              {' '}is{' '}
              <span className="font-black">{ratio}×</span>
              {' '}more efficient per MB of resources delivered.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EfficencyBar({ label, color, glow, score, mb, barW, isWinner, delay }: {
  label: string; color: string; glow: string;
  score: number | null; mb: number | null;
  barW: number; isWinner: boolean; delay: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-[11px] font-semibold" style={{ color: '#94a3b8' }}>{label}</span>
          {mb && (
            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
              ({mb.toFixed(2)} MB bundle)
            </span>
          )}
        </div>
        <span
          className="text-[13px] font-black tabular-nums antialiased"
          style={{ color: score ? (isWinner ? '#ffffff' : 'rgba(255,255,255,0.40)') : 'rgba(255,255,255,0.20)', letterSpacing: '0.02em' }}
        >
          {score ? `${score} pts/MB` : 'N/A'}
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barW}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay }}
          className="h-full rounded-full"
          style={{
            background: isWinner ? `linear-gradient(90deg, ${color}, ${color}cc)` : `${color}35`,
            boxShadow:  isWinner ? `0 0 10px ${glow}` : 'none',
          }}
        />
      </div>
    </div>
  );
}

// ─── Normalised Metrics table ─────────────────────────────────────────────────

function NormalisedMetrics({ target, competitor }: { target: AnalysisResult; competitor: AnalysisResult }) {
  const rows = useMemo(() => METRIC_META.map(({ key, label, fmt }) => {
    const th = THRESHOLDS[key];
    const tVal  = target.metrics[key];
    const cVal  = competitor.metrics[key];
    const tNorm = normalise(tVal, th.good, th.poor);
    const cNorm = normalise(cVal, th.good, th.poor);
    const { ratio, winner } = metricRatio(tVal, cVal);
    const isGap = ratio >= 2 && winner !== 'tied';
    return { key, label, tVal, cVal, tNorm, cNorm, ratio, winner, isGap, fmt };
  }), [target, competitor]);

  return (
    <div>
      <SectionHeader
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        title="Normalised Metrics"
        sub="Each metric scored 0–100 based on Google Web Vitals thresholds"
      />
      {/* Column header */}
      <div
        className="grid items-center gap-3 px-6 py-2 text-[9px] font-bold uppercase tracking-widest"
        style={{ gridTemplateColumns: '100px 56px 1fr 56px 110px', borderBottom: `1px solid ${DIVIDER}`, color: 'rgba(255,255,255,0.22)' }}
      >
        <span>Metric</span>
        <span className="text-right" style={{ color: T_HEX + '99' }}>You</span>
        <span className="text-center">Score (0–100)</span>
        <span style={{ color: C_HEX + '99' }}>Rival</span>
        <span className="text-right">Delta</span>
      </div>

      <div className="space-y-0.5 py-2 px-3">
        {rows.map((row, i) => (
          <NormRow key={row.key} row={row} index={i} />
        ))}
      </div>
    </div>
  );
}

type NormRowData = {
  key: string; label: string; tVal: number; cVal: number;
  tNorm: number; cNorm: number; ratio: number;
  winner: 'target' | 'competitor' | 'tied';
  isGap: boolean; fmt: (v: number) => string;
};

// Fix the NormRow prop type
function NormRow({ row, index }: { row: NormRowData; index: number }) {
  const tWins = row.winner === 'target';
  const cWins = row.winner === 'competitor';
  const maxN  = Math.max(row.tNorm, row.cNorm, 1);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay: index * 0.045 }}
      className="grid items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
      style={{
        gridTemplateColumns: '100px 56px 1fr 56px 110px',
        background: row.isGap ? `${GAP_CLR}08` : 'rgba(255,255,255,0.02)',
        border: row.isGap ? `1px solid ${GAP_CLR}28` : '1px solid transparent',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = row.isGap ? `${GAP_CLR}12` : 'rgba(255,255,255,0.045)')}
      onMouseLeave={e => (e.currentTarget.style.background = row.isGap ? `${GAP_CLR}08` : 'rgba(255,255,255,0.02)')}
    >
      <div className="flex items-center gap-1.5">
        {row.isGap && <AlertTriangle className="w-2.5 h-2.5 shrink-0" style={{ color: GAP_CLR }} />}
        <span className="text-[11px] font-bold" style={{ color: row.isGap ? '#fca5a5' : '#94a3b8' }}>{row.label}</span>
      </div>

      <span className="text-[12px] font-black tabular-nums text-right antialiased"
        style={{ color: tWins ? '#ffffff' : 'rgba(255,255,255,0.32)', letterSpacing: '0.01em' }}>
        {row.tNorm}
      </span>

      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(row.tNorm / maxN) * 50}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.04 }}
          className="absolute left-0 top-0 h-full rounded-l-full"
          style={{
            background: tWins ? `linear-gradient(90deg, ${T_HEX}60, ${T_HEX})` : `${T_HEX}28`,
            boxShadow:  tWins && row.isGap ? `0 0 8px ${T_GLOW}` : 'none',
          }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(row.cNorm / maxN) * 50}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.04 }}
          className="absolute right-0 top-0 h-full rounded-r-full"
          style={{
            background: cWins ? `linear-gradient(270deg, ${C_HEX}60, ${C_HEX})` : `${C_HEX}28`,
            boxShadow:  cWins && row.isGap ? `0 0 8px ${C_GLOW}` : 'none',
          }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-px"
          style={{ background: 'rgba(255,255,255,0.18)' }} />
      </div>

      <span className="text-[12px] font-black tabular-nums antialiased"
        style={{ color: cWins ? '#ffffff' : 'rgba(255,255,255,0.32)', letterSpacing: '0.01em' }}>
        {row.cNorm}
      </span>

      <div className="flex justify-end">
        {row.isGap ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap"
            style={{
              color: '#fca5a5', background: `${GAP_CLR}18`,
              border: `1px solid ${GAP_CLR}50`, backdropFilter: 'blur(8px)',
              boxShadow: `0 0 12px ${GAP_CLR}25`,
            }}>
            <Zap className="w-2.5 h-2.5 shrink-0" style={{ color: GAP_CLR }} />
            ⚡ {row.ratio}× Gap
          </span>
        ) : row.winner !== 'tied' ? (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap"
            style={{
              color: tWins ? T_HEX : C_HEX,
              background: tWins ? 'rgba(139,92,246,0.12)' : 'rgba(245,158,11,0.12)',
              border: `1px solid ${tWins ? 'rgba(139,92,246,0.30)' : 'rgba(245,158,11,0.30)'}`,
            }}>
            {tWins ? 'You' : 'Rival'} +{Math.round(Math.abs(row.tNorm - row.cNorm))}pts
          </span>
        ) : (
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.18)' }}>Tied</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Performance Gaps callout ─────────────────────────────────────────────────

function GapsCallout({ target, competitor }: { target: AnalysisResult; competitor: AnalysisResult }) {
  const gaps = useMemo(() => METRIC_META.map(({ key, label, fmt }) => {
    const tVal = target.metrics[key];
    const cVal = competitor.metrics[key];
    const { ratio, winner } = metricRatio(tVal, cVal);
    if (ratio < 2 || winner === 'tied') return null;
    return { key, label, tVal, cVal, ratio, winner, fmt };
  }).filter(Boolean) as NonNullable<ReturnType<typeof metricRatio> & { key: string; label: string; tVal: number; cVal: number; fmt: (v: number) => string }>[], [target, competitor]);

  if (!gaps.length) return null;

  return (
    <div style={{ borderTop: `1px solid ${DIVIDER}` }}>
      <SectionHeader
        icon={<AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
        title={`Performance Gaps — ${gaps.length} metric${gaps.length > 1 ? 's' : ''} with ≥ 2× advantage`}
      />
      <div className="space-y-2 px-5 py-4">
        {gaps.map((gap, i) => {
          const tWins    = gap.winner === 'target';
          const better   = tWins ? gap.tVal : gap.cVal;
          const worse    = tWins ? gap.cVal : gap.tVal;
          const betterW  = (better / (better + worse)) * 100;
          const worseW   = (worse  / (better + worse)) * 100;
          const winLabel = tWins ? 'Your Site' : 'Competitor';
          const winColor = tWins ? T_HEX : C_HEX;
          const winGlow  = tWins ? T_GLOW : C_GLOW;

          return (
            <motion.div
              key={gap.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="rounded-xl px-4 py-3.5 space-y-2.5"
              style={{ background: `${GAP_CLR}08`, border: `1px solid ${GAP_CLR}30` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-[12px] font-bold text-white">{gap.label}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                    style={{ background: `${winColor}18`, border: `1px solid ${winColor}40`, color: winColor }}>
                    {winLabel} wins
                  </span>
                </div>
                <span
                  className="text-[11px] font-black"
                  style={{
                    color: GAP_CLR,
                    textShadow: `0 0 12px rgba(239,68,68,0.5)`,
                  }}
                >
                  {gap.ratio}× faster
                </span>
              </div>

              {/* Gap bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tabular-nums w-14 text-right" style={{ color: tWins ? '#ffffff' : 'rgba(255,255,255,0.35)' }}>
                  {gap.fmt(gap.tVal)}
                </span>
                <div className="flex-1 flex items-center gap-0" style={{ height: 10 }}>
                  {/* Left: Your Site */}
                  <div className="flex justify-end overflow-hidden" style={{ flex: 1, height: '100%', borderRadius: '99px 0 0 99px', background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${tWins ? betterW : worseW}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.06 }}
                      style={{
                        height: '100%', borderRadius: '99px 0 0 99px',
                        background: tWins ? `linear-gradient(270deg, ${T_HEX}, #c4b5fd)` : `${T_HEX}30`,
                        boxShadow: tWins ? `0 0 10px ${T_GLOW}` : 'none',
                      }}
                    />
                  </div>
                  <div style={{ width: 1.5, height: 16, flexShrink: 0, background: 'rgba(255,255,255,0.20)' }} />
                  {/* Right: Competitor */}
                  <div className="flex justify-start overflow-hidden" style={{ flex: 1, height: '100%', borderRadius: '0 99px 99px 0', background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${!tWins ? betterW : worseW}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.06 }}
                      style={{
                        height: '100%', borderRadius: '0 99px 99px 0',
                        background: !tWins ? `linear-gradient(90deg, ${C_HEX}, #fde68a)` : `${C_HEX}30`,
                        boxShadow: !tWins ? `0 0 10px ${C_GLOW}` : 'none',
                      }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-bold tabular-nums w-14" style={{ color: !tWins ? '#ffffff' : 'rgba(255,255,255,0.35)' }}>
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={PANEL}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-6 py-4"
        style={{ borderBottom: `1px solid ${DIVIDER}` }}
      >
        <Zap className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>Comparison Engine</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-md"
          style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.28)', color: '#a78bfa' }}>
          Normalised Analysis
        </span>
      </div>

      <EfficiencySection target={target} competitor={competitor} />
      <NormalisedMetrics target={target} competitor={competitor} />
      <GapsCallout       target={target} competitor={competitor} />

      {/* Footer formula legend */}
      <div
        className="px-6 py-3 text-[9px] flex flex-wrap gap-x-6 gap-y-1"
        style={{ borderTop: `1px solid ${DIVIDER}`, color: 'rgba(255,255,255,0.22)' }}
      >
        <span>Efficiency = Lighthouse score ÷ bundle MB</span>
        <span>Normalised score = (poor − value) ÷ (poor − good) × 100, clamped 0–100</span>
        <span style={{ color: '#fca5a5' }}>⚡ Performance Gap = raw metric ratio ≥ 2×</span>
      </div>
    </motion.div>
  );
}
