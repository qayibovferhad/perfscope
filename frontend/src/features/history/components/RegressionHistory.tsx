import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, AlertTriangle, Zap, GitCommit, Info } from 'lucide-react';
import type { HistoryEntry } from '../hooks/useHistory';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  background:           'rgba(17,24,39,0.72)',
  backdropFilter:       'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border:               '1px solid rgba(255,255,255,0.10)',
  borderRadius:         '1rem',
  overflow:             'hidden',
};

const DIVIDER  = 'rgba(255,255,255,0.08)';
const LCP_CLR  = '#8B5CF6';   // purple
const TBT_CLR  = '#F59E0B';   // amber
const LCP_GLOW = 'rgba(139,92,246,0.6)';
const TBT_GLOW = 'rgba(245,158,11,0.6)';
const REG_CLR  = '#ef4444';
const REG_GLOW = 'rgba(239,68,68,0.75)';

const REGRESSION_THRESHOLD = 0.15;   // 15%

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function deltaPct(curr: number, prev: number) {
  if (!prev) return 0;
  return ((curr - prev) / prev) * 100;
}

function isRegression(curr: number, prev: number) {
  return deltaPct(curr, prev) > REGRESSION_THRESHOLD * 100;
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

const CHART_W = 680;
const CHART_H = 200;
const PAD     = { top: 20, right: 24, bottom: 40, left: 56 };

interface ChartLine {
  key:   'lcp' | 'tbt';
  label: string;
  color: string;
  glow:  string;
  fmt:   (v: number) => string;
}

const LINES: ChartLine[] = [
  { key: 'lcp', label: 'LCP', color: LCP_CLR, glow: LCP_GLOW, fmt: fmtMs },
  { key: 'tbt', label: 'TBT', color: TBT_CLR, glow: TBT_GLOW, fmt: fmtMs },
];

function linePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function EvolutionChart({
  entries, hoveredIdx, onHover,
}: {
  entries: HistoryEntry[];
  hoveredIdx: number | null;
  onHover: (i: number | null) => void;
}) {
  const n = entries.length;
  if (n < 1) return null;

  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  // Compute x positions
  const xOf = (i: number) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);

  // Scale y for each metric
  function yScale(key: 'lcp' | 'tbt') {
    const vals = entries.map(e => e.metrics[key]);
    const min  = Math.min(...vals) * 0.85;
    const max  = Math.max(...vals) * 1.10;
    return (v: number) => PAD.top + innerH - ((v - min) / (max - min || 1)) * innerH;
  }

  // Tick values for Y axis (using LCP scale)
  const lcpVals  = entries.map(e => e.metrics.lcp);
  const lcpMin   = Math.min(...lcpVals) * 0.85;
  const lcpMax   = Math.max(...lcpVals) * 1.10;
  const yTicks   = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    v:   lcpMin + t * (lcpMax - lcpMin),
    y:   PAD.top + innerH * (1 - t),
  }));

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
    >
      <defs>
        {LINES.map(l => (
          <filter key={l.key} id={`glow-${l.key}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
        <filter id="glow-reg">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {LINES.map(l => (
          <linearGradient key={l.key} id={`area-${l.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={l.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={l.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD.left} y1={t.y} x2={CHART_W - PAD.right} y2={t.y}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1"
          />
          <text x={PAD.left - 6} y={t.y + 4} textAnchor="end"
            fill="rgba(255,255,255,0.22)" fontSize="9" fontFamily="monospace">
            {fmtMs(t.v)}
          </text>
        </g>
      ))}

      {/* Vertical hover column */}
      {hoveredIdx !== null && (
        <line
          x1={xOf(hoveredIdx)} y1={PAD.top}
          x2={xOf(hoveredIdx)} y2={PAD.top + innerH}
          stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="4 3"
        />
      )}

      {/* Area fills + lines */}
      {LINES.map(l => {
        const yFn  = yScale(l.key);
        const pts  = entries.map((e, i) => ({ x: xOf(i), y: yFn(e.metrics[l.key]) }));
        const area = pts.length > 1
          ? `${linePath(pts)} L${pts.at(-1)!.x},${PAD.top + innerH} L${pts[0].x},${PAD.top + innerH} Z`
          : '';

        return (
          <g key={l.key}>
            {area && <path d={area} fill={`url(#area-${l.key})`} />}
            <path
              d={linePath(pts)}
              fill="none"
              stroke={l.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={`url(#glow-${l.key})`}
              style={{ filter: `drop-shadow(0 0 6px ${l.glow})` }}
            />
          </g>
        );
      })}

      {/* Data points */}
      {entries.map((entry, i) => {
        const lcpY   = yScale('lcp')(entry.metrics.lcp);
        const tbtY   = yScale('tbt')(entry.metrics.tbt);
        const prevE  = entries[i - 1];
        const regLcp = prevE ? isRegression(entry.metrics.lcp, prevE.metrics.lcp) : false;
        const regTbt = prevE ? isRegression(entry.metrics.tbt, prevE.metrics.tbt) : false;
        const isReg  = regLcp || regTbt;
        const isHov  = hoveredIdx === i;

        return (
          <g key={i}>
            {/* LCP dot */}
            {isReg ? (
              <>
                <circle cx={xOf(i)} cy={lcpY} r={10}
                  fill="transparent" stroke={REG_CLR} strokeWidth="1.5" opacity="0.3"
                  style={{ filter: `drop-shadow(0 0 8px ${REG_GLOW})` }} />
                <circle cx={xOf(i)} cy={lcpY} r={6}
                  fill={REG_CLR} filter="url(#glow-reg)"
                  style={{ filter: `drop-shadow(0 0 10px ${REG_GLOW})` }} />
              </>
            ) : (
              <circle cx={xOf(i)} cy={lcpY} r={isHov ? 5 : 3.5}
                fill={LCP_CLR} stroke="rgba(17,24,39,0.9)" strokeWidth="1.5"
                style={{ transition: 'r 0.15s' }} />
            )}

            {/* TBT dot */}
            <circle cx={xOf(i)} cy={tbtY} r={isHov ? 5 : 3.5}
              fill={TBT_CLR} stroke="rgba(17,24,39,0.9)" strokeWidth="1.5"
              style={{ transition: 'r 0.15s' }} />

            {/* Regression label */}
            {isReg && (
              <g>
                <text x={xOf(i)} y={lcpY - 18} textAnchor="middle"
                  fill={REG_CLR} fontSize="8" fontWeight="bold" letterSpacing="0.05em"
                  style={{ filter: `drop-shadow(0 0 6px ${REG_GLOW})` }}>
                  REGRESSION
                </text>
              </g>
            )}

            {/* X axis label */}
            <text x={xOf(i)} y={PAD.top + innerH + 16} textAnchor="middle"
              fill="rgba(255,255,255,0.28)" fontSize="9" fontFamily="monospace">
              {fmtDate(entry.timestamp)}
            </text>
            <text x={xOf(i)} y={PAD.top + innerH + 27} textAnchor="middle"
              fill="rgba(255,255,255,0.16)" fontSize="8" fontFamily="monospace">
              #{entry.shortId}
            </text>

            {/* Invisible hover target */}
            <rect
              x={xOf(i) - 20} y={PAD.top} width={40} height={innerH}
              fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Delta Panel ─────────────────────────────────────────────────────────────

function DeltaPanel({ curr, prev }: { curr: HistoryEntry; prev: HistoryEntry | null }) {
  const items: { label: string; curr: number; prev: number | null; fmt: (v: number) => string }[] = [
    { label: 'LCP', curr: curr.metrics.lcp, prev: prev?.metrics.lcp ?? null, fmt: fmtMs },
    { label: 'TBT', curr: curr.metrics.tbt, prev: prev?.metrics.tbt ?? null, fmt: fmtMs },
    { label: 'FCP', curr: curr.metrics.fcp, prev: prev?.metrics.fcp ?? null, fmt: fmtMs },
    { label: 'Score', curr: curr.scores.performance, prev: prev?.scores.performance ?? null, fmt: v => `${Math.round(v)}` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, curr: c, prev: p, fmt }) => {
        const pct    = p !== null ? deltaPct(c, p) : null;
        const reg    = p !== null && label !== 'Score' ? isRegression(c, p) : (pct !== null && pct < -10);
        const better = pct !== null && (label === 'Score' ? pct > 0 : pct < 0);

        return (
          <div
            key={label}
            className="rounded-xl px-4 py-3 flex flex-col gap-1"
            style={{
              background: reg
                ? 'rgba(239,68,68,0.08)'
                : better
                ? 'rgba(16,185,129,0.07)'
                : 'rgba(255,255,255,0.03)',
              border: reg
                ? `1px solid rgba(239,68,68,0.25)`
                : better
                ? '1px solid rgba(16,185,129,0.20)'
                : `1px solid ${DIVIDER}`,
            }}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.30)' }}>
              {label}
            </span>
            <span className="text-[18px] font-black tabular-nums"
              style={{ color: reg ? REG_CLR : better ? '#10b981' : '#e2e8f0' }}>
              {fmt(c)}
            </span>
            {pct !== null && (
              <span className="text-[10px] font-semibold"
                style={{ color: reg ? REG_CLR : better ? '#10b981' : 'rgba(255,255,255,0.30)' }}>
                {pct > 0 ? '+' : ''}{pct.toFixed(1)}% vs prev
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Hover Tooltip ────────────────────────────────────────────────────────────

function HoverTooltip({ entry, prev }: { entry: HistoryEntry; prev: HistoryEntry | null }) {
  const regLcp = prev ? isRegression(entry.metrics.lcp, prev.metrics.lcp) : false;
  const regTbt = prev ? isRegression(entry.metrics.tbt, prev.metrics.tbt) : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl px-4 py-3 text-[11px] space-y-2"
      style={{
        background:     'rgba(13,18,36,0.96)',
        backdropFilter: 'blur(12px)',
        border:         '1px solid rgba(255,255,255,0.12)',
        minWidth:       200,
      }}
    >
      <div className="flex items-center gap-2">
        <GitCommit className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.40)' }} />
        <span className="font-mono font-bold" style={{ color: 'rgba(255,255,255,0.70)' }}>
          #{entry.shortId}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.28)' }}>{fmtDate(entry.timestamp)}</span>
      </div>

      {(regLcp || regTbt) && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)' }}>
          <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: REG_CLR }} />
          <span style={{ color: REG_CLR, fontWeight: 700 }}>Regression Detected</span>
        </div>
      )}

      <div className="space-y-1">
        {[
          { label: 'LCP', val: entry.metrics.lcp, prev: prev?.metrics.lcp, color: LCP_CLR, fmt: fmtMs },
          { label: 'TBT', val: entry.metrics.tbt, prev: prev?.metrics.tbt, color: TBT_CLR, fmt: fmtMs },
          { label: 'FCP', val: entry.metrics.fcp, prev: prev?.metrics.fcp, color: '#3b82f6', fmt: fmtMs },
          { label: 'Score', val: entry.scores.performance, prev: prev?.scores.performance, color: '#10b981', fmt: (v: number) => `${Math.round(v)}` },
        ].map(({ label, val, prev: p, color, fmt }) => {
          const pct = p !== undefined ? deltaPct(val, p) : null;
          return (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {label}
              </span>
              <span className="flex items-center gap-2 font-mono">
                <span style={{ color: '#e2e8f0' }}>{fmt(val)}</span>
                {pct !== null && (
                  <span style={{ color: pct > 15 ? REG_CLR : pct < -5 ? '#10b981' : 'rgba(255,255,255,0.30)', fontSize: '9px' }}>
                    {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 pt-1" style={{ borderTop: `1px solid ${DIVIDER}` }}>
        <span className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.22)' }}>Performance</span>
        <span className="font-black tabular-nums ml-auto"
          style={{ color: '#e2e8f0' }}>{Math.round(entry.scores.performance)}</span>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RegressionHistory({ entries }: { entries: HistoryEntry[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasRegression = useMemo(() => {
    for (let i = 1; i < entries.length; i++) {
      if (
        isRegression(entries[i].metrics.lcp, entries[i - 1].metrics.lcp) ||
        isRegression(entries[i].metrics.tbt, entries[i - 1].metrics.tbt)
      ) return true;
    }
    return false;
  }, [entries]);

  const last     = entries[entries.length - 1];
  const prevLast = entries.length >= 2 ? entries[entries.length - 2] : null;

  if (!last) return null;

  const hoveredEntry = hoveredIdx !== null ? entries[hoveredIdx] : null;
  const hoveredPrev  = hoveredIdx !== null && hoveredIdx > 0 ? entries[hoveredIdx - 1] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={PANEL}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: `1px solid ${DIVIDER}` }}>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>
            Performance Evolution
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
            Last {entries.length} run{entries.length !== 1 ? 's' : ''}
          </span>
        </div>

        {hasRegression && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg"
            style={{
              background: 'rgba(239,68,68,0.10)',
              border:     '1px solid rgba(239,68,68,0.30)',
            }}>
            <AlertTriangle className="w-3 h-3" style={{ color: REG_CLR }} />
            <span className="text-[10px] font-bold" style={{ color: REG_CLR }}>
              Regression Detected
            </span>
          </div>
        )}
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* ── Delta Panel ── */}
        <DeltaPanel curr={last} prev={prevLast} />

        {/* ── Line Chart + Tooltip ── */}
        <div className="relative">
          <div className="flex items-center gap-4 mb-3">
            {[
              { color: LCP_CLR, glow: LCP_GLOW, label: 'LCP' },
              { color: TBT_CLR, glow: TBT_GLOW, label: 'TBT' },
              { color: REG_CLR, glow: REG_GLOW, label: 'Regression', dot: true },
            ].map(({ color, glow, label, dot }) => (
              <span key={label} className="flex items-center gap-1.5 text-[9px]"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                {dot ? (
                  <span className="w-2.5 h-2.5 rounded-full border"
                    style={{ borderColor: color, boxShadow: `0 0 6px ${glow}` }} />
                ) : (
                  <span className="w-4 h-0.5 rounded-full inline-block"
                    style={{ background: color, boxShadow: `0 0 4px ${glow}` }} />
                )}
                {label}
              </span>
            ))}
            <span className="ml-auto text-[9px] flex items-center gap-1"
              style={{ color: 'rgba(255,255,255,0.20)' }}>
              <Info className="w-2.5 h-2.5" />
              Hover a point to inspect
            </span>
          </div>

          <EvolutionChart
            entries={entries}
            hoveredIdx={hoveredIdx}
            onHover={setHoveredIdx}
          />

          {/* Floating tooltip */}
          <AnimatePresence>
            {hoveredEntry && (
              <div className="absolute top-10 right-0 z-20">
                <HoverTooltip entry={hoveredEntry} prev={hoveredPrev} />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Senior Insight ── */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(139,92,246,0.06))',
            border:     '1px solid rgba(99,102,241,0.22)',
          }}
        >
          <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#818cf8' }} />
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest block mb-0.5"
              style={{ color: '#818cf8' }}>
              Senior Insight
            </span>
            <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.70)' }}>
              This regression is likely caused by the{' '}
              <span style={{ color: REG_CLR, fontWeight: 700 }}>8.10 MB GIF</span>
              {' '}added in the latest build — large unoptimized media blocks LCP and inflates TBT.
            </p>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-6 py-3 flex-wrap gap-2"
        style={{ borderTop: `1px solid ${DIVIDER}`, color: 'rgba(255,255,255,0.18)' }}>
        <span className="text-[9px]">
          Regression threshold: &gt;15% degradation vs previous run
        </span>
        <span className="text-[9px] font-mono">
          latest: #{last.shortId} · {fmtDate(last.timestamp)}
        </span>
      </div>
    </motion.div>
  );
}
