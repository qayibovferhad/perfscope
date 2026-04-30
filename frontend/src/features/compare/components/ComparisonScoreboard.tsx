import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Zap } from 'lucide-react';
import type { AnalysisResult, CoreWebVitals } from '../../analyzer/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  target:     AnalysisResult;
  competitor: AnalysisResult;
}

interface MetricDef {
  key:           keyof CoreWebVitals;
  abbr:          string;
  label:         string;
  lowerIsBetter: boolean;
  fmt:           (v: number) => string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const METRICS: MetricDef[] = [
  { key: 'lcp', abbr: 'LCP', label: 'Largest Contentful Paint', lowerIsBetter: true, fmt: v => `${(v / 1000).toFixed(2)}s`  },
  { key: 'fcp', abbr: 'FCP', label: 'First Contentful Paint',   lowerIsBetter: true, fmt: v => `${(v / 1000).toFixed(2)}s`  },
  { key: 'tbt', abbr: 'TBT', label: 'Total Blocking Time',      lowerIsBetter: true, fmt: v => `${Math.round(v)}ms`          },
  { key: 'tti', abbr: 'TTI', label: 'Time to Interactive',      lowerIsBetter: true, fmt: v => `${(v / 1000).toFixed(2)}s`  },
  { key: 'si',  abbr: 'SI',  label: 'Speed Index',              lowerIsBetter: true, fmt: v => `${(v / 1000).toFixed(2)}s`  },
  { key: 'cls', abbr: 'CLS', label: 'Cumulative Layout Shift',  lowerIsBetter: true, fmt: v => v.toFixed(3)                 },
];

const TARGET_COLOR     = '#818cf8'; // indigo-400
const COMPETITOR_COLOR = '#fb923c'; // orange-400
const TARGET_GLOW      = 'rgba(129,140,248,0.5)';
const COMPETITOR_GLOW  = 'rgba(251,146,60,0.5)';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctLabel(winner: number, loser: number): string {
  if (loser === 0 || winner === loser) return '';
  const pct = Math.round(Math.abs((loser - winner) / loser) * 100);
  if (pct < 1) return '';
  return pct >= 20 ? `${pct}% more efficient` : `${pct}% faster`;
}

// ─── Circular Score ───────────────────────────────────────────────────────────

function CircularScore({
  score, color, glow, label, isWinner,
}: {
  score: number; color: string; glow: string; label: string; isWinner: boolean;
}) {
  const circleRef = useRef<SVGCircleElement>(null);
  const SIZE       = 140;
  const R          = 52;
  const CIRCUM     = 2 * Math.PI * R;

  useEffect(() => {
    if (!circleRef.current) return;
    const offset = CIRCUM - (score / 100) * CIRCUM;
    circleRef.current.style.strokeDashoffset = String(offset);
  }, [score, CIRCUM]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex flex-col items-center gap-3"
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={10}
          />
          {/* Arc */}
          <circle
            ref={circleRef}
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            style={{
              strokeDasharray:  CIRCUM,
              strokeDashoffset: CIRCUM,
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)',
              filter: `drop-shadow(0 0 8px ${glow})`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-3xl font-bold tabular-nums leading-none" style={{ color }}>
            {score}
          </span>
          <span className="text-[10px] text-white/30 tabular-nums">/ 100</span>
        </div>

        {/* Winner crown */}
        {isWinner && (
          <div
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' }}
          >
            <Trophy className="w-3 h-3 text-amber-400" />
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-[11px] font-semibold text-white/70">{label}</p>
        {isWinner && (
          <p className="text-[10px] font-semibold text-amber-400 mt-0.5">Overall Winner</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  abbr, label, lowerIsBetter, fmt,
  tVal, cVal,
}: MetricDef & { tVal: number; cVal: number }) {
  const tied  = tVal === cVal;
  const tWins = !tied && (lowerIsBetter ? tVal < cVal : tVal > cVal);
  const cWins = !tied && !tWins;

  // Bar widths: both fill proportionally vs each other.
  // For lower-is-better: shorter bar = better. Winner bar is bright, loser bar is dim.
  const maxVal = Math.max(tVal, cVal) || 1;
  const tBarW  = (tVal / maxVal) * 100;
  const cBarW  = (cVal / maxVal) * 100;

  const badge = tWins ? pctLabel(tVal, cVal) : cWins ? pctLabel(cVal, tVal) : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        background:    'rgba(10, 15, 35, 0.85)',
        backdropFilter:'blur(16px)',
        border:        '1px solid rgba(255,255,255,0.08)',
      }}
      className="rounded-2xl overflow-hidden"
    >
      <div className="grid grid-cols-[1fr_56px_1fr]">

        {/* ── Left: Your Site ── */}
        <div
          className="px-4 pt-4 pb-3 flex flex-col gap-2"
          style={{ background: 'rgba(99,102,241,0.06)' }}
        >
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: TARGET_COLOR + 'aa' }}>
            Your Site
          </p>

          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-lg font-bold leading-none text-white">{fmt(tVal)}</span>
            {tWins && badge && (
              <GlassBadge label={badge} color={TARGET_COLOR} glow={TARGET_GLOW} />
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${tBarW}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
              className="h-full rounded-full"
              style={{
                background: tWins
                  ? `linear-gradient(90deg, ${TARGET_COLOR}, #a5b4fc)`
                  : 'rgba(129,140,248,0.25)',
                boxShadow: tWins ? `0 0 8px ${TARGET_GLOW}` : 'none',
              }}
            />
          </div>

          {tWins && (
            <span className="text-[9px] font-semibold text-emerald-400 flex items-center gap-0.5">
              <Trophy className="w-2.5 h-2.5" /> Winner
            </span>
          )}
        </div>

        {/* ── Center: Metric Label ── */}
        <div className="flex flex-col items-center justify-center gap-1 border-x border-white/[0.06]"
          style={{ background: 'rgba(255,255,255,0.01)' }}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">{abbr}</span>
          <div className="w-px flex-1 bg-white/10 my-1" />
          <p className="text-[8px] text-center text-white/25 px-1 leading-tight">{label}</p>
        </div>

        {/* ── Right: Competitor ── */}
        <div
          className="px-4 pt-4 pb-3 flex flex-col gap-2 items-end"
          style={{ background: 'rgba(249,115,22,0.06)' }}
        >
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: COMPETITOR_COLOR + 'aa' }}>
            Competitor
          </p>

          <div className="flex items-baseline gap-1.5 flex-wrap justify-end">
            {cWins && badge && (
              <GlassBadge label={badge} color={COMPETITOR_COLOR} glow={COMPETITOR_GLOW} />
            )}
            <span className="text-lg font-bold leading-none text-white">{fmt(cVal)}</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden w-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${cBarW}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
              className="h-full rounded-full ml-auto"
              style={{
                background: cWins
                  ? `linear-gradient(270deg, ${COMPETITOR_COLOR}, #fdba74)`
                  : 'rgba(249,115,22,0.25)',
                boxShadow: cWins ? `0 0 8px ${COMPETITOR_GLOW}` : 'none',
              }}
            />
          </div>

          {cWins && (
            <span className="text-[9px] font-semibold text-emerald-400 flex items-center gap-0.5">
              <Trophy className="w-2.5 h-2.5" /> Winner
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Glassmorphism Badge ──────────────────────────────────────────────────────

function GlassBadge({ label, color, glow }: { label: string; color: string; glow: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
      style={{
        color,
        background:    `rgba(${hexToRgb(color)}, 0.12)`,
        border:        `1px solid rgba(${hexToRgb(color)}, 0.3)`,
        backdropFilter:'blur(8px)',
        boxShadow:     `0 0 10px rgba(${hexToRgb(color)}, 0.15)`,
      }}
    >
      <Zap className="w-2 h-2 shrink-0" />
      {label}
    </span>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ─── Main Scoreboard ──────────────────────────────────────────────────────────

export function ComparisonScoreboard({ target, competitor }: Props) {
  const tScore = Math.round(target.scores.performance     * 100);
  const cScore = Math.round(competitor.scores.performance * 100);
  const tWinsOverall = tScore > cScore;
  const cWinsOverall = cScore > tScore;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background:    'rgba(8, 12, 28, 0.95)',
        border:        '1px solid rgba(255,255,255,0.09)',
        backdropFilter:'blur(20px)',
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Trophy className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">Performance Scoreboard</span>
      </div>

      {/* ── Circular Scores ── */}
      <div className="flex items-center justify-center gap-16 py-10 px-6"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <CircularScore
          score={tScore}
          color={TARGET_COLOR}
          glow={TARGET_GLOW}
          label="Your Site"
          isWinner={tWinsOverall}
        />

        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">vs</span>
          {tScore !== cScore && (
            <span className="text-[11px] font-semibold text-white/40">
              {Math.abs(tScore - cScore)} pts diff
            </span>
          )}
        </div>

        <CircularScore
          score={cScore}
          color={COMPETITOR_COLOR}
          glow={COMPETITOR_GLOW}
          label="Competitor"
          isWinner={cWinsOverall}
        />
      </div>

      {/* ── Metric Cards Grid ── */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 p-6">
        {METRICS.map((m, i) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
          >
            <MetricCard
              {...m}
              tVal={target.metrics[m.key]}
              cVal={competitor.metrics[m.key]}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
