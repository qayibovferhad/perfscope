import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompareArrows, Trophy, Clock, Search, TrendingUp, TrendingDown,
  Minus, ChevronRight, X, Zap, History,
} from 'lucide-react';
import { useCompareHistoryList, useCompareHistoryPair, type CompareEntry } from './useCompareHistory';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const PAGE_BG = '#030712';
const PANEL: React.CSSProperties = {
  background:           'rgba(17,24,39,0.72)',
  backdropFilter:       'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border:               '1px solid rgba(255,255,255,0.10)',
  borderRadius:         '1rem',
  overflow:             'hidden',
};
const DIVIDER  = 'rgba(255,255,255,0.08)';
const T_HEX    = '#8B5CF6';
const T_GLOW   = 'rgba(139,92,246,0.55)';
const C_HEX    = '#F59E0B';
const C_GLOW   = 'rgba(245,158,11,0.55)';
const OK_CLR   = '#10b981';
const REG_CLR  = '#ef4444';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMs  = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
const score  = (e: CompareEntry, side: 'source' | 'competitor') =>
  Math.round(e[side].scores['performance'] ?? 0);

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateFull(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-1.5 text-sm select-none flex-wrap">
      {[
        { to: '/',        label: 'Analyzer' },
        { to: '/compare', label: 'Competitive Analysis' },
      ].map(({ to, label }) => (
        <span key={to} className="flex items-center gap-1.5">
          <Link to={to} className="font-medium transition-all duration-150"
            style={{ color: 'rgba(255,255,255,0.40)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T_HEX; (e.currentTarget as HTMLElement).style.textShadow = `0 0 12px ${T_GLOW}`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.40)'; (e.currentTarget as HTMLElement).style.textShadow = 'none'; }}>
            {label}
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 16 }}>›</span>
        </span>
      ))}
      <div className="flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" style={{ color: T_HEX }} />
        <span className="font-semibold" style={{ color: '#e2e8f0' }}>Compare History</span>
      </div>
    </nav>
  );
}

// ─── Dual Trend Chart ─────────────────────────────────────────────────────────

const CW = 640; const CH = 180;
const PAD = { t: 16, r: 20, b: 48, l: 48 };

function DualTrendChart({ entries }: { entries: CompareEntry[] }) {
  const n = entries.length;
  if (n < 2) return null;

  const iW = CW - PAD.l - PAD.r;
  const iH = CH - PAD.t - PAD.b;
  const xOf = (i: number) => PAD.l + (i / (n - 1)) * iW;

  const allScores = entries.flatMap(e => [score(e, 'source'), score(e, 'competitor')]);
  const sMin = Math.min(...allScores) * 0.9;
  const sMax = Math.max(...allScores) * 1.05;
  const yOf  = (v: number) => PAD.t + iH - ((v - sMin) / (sMax - sMin || 1)) * iH;

  const srcPts  = entries.map((e, i) => ({ x: xOf(i), y: yOf(score(e, 'source')) }));
  const cmpPts  = entries.map((e, i) => ({ x: xOf(i), y: yOf(score(e, 'competitor')) }));
  const toPath  = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Gap delta evolution (source - competitor score)
  const deltas  = entries.map(e => score(e, 'source') - score(e, 'competitor'));
  const lastDelta = deltas[deltas.length - 1];
  const prevDelta = deltas.length >= 2 ? deltas[deltas.length - 2] : null;
  const deltaChange = prevDelta !== null ? lastDelta - prevDelta : 0;

  const yTicks = [0, 0.5, 1].map(t => ({
    v: sMin + t * (sMax - sMin), y: PAD.t + iH * (1 - t),
  }));

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          {[{ id: 'src', color: T_HEX }, { id: 'cmp', color: C_HEX }].map(({ id, color }) => (
            <linearGradient key={id} id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={t.y} x2={CW - PAD.r} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fill="rgba(255,255,255,0.20)" fontSize="9" fontFamily="monospace">
              {Math.round(t.v)}
            </text>
          </g>
        ))}

        {/* Area fills */}
        <path
          d={`${toPath(srcPts)} L${srcPts[n-1].x},${PAD.t + iH} L${PAD.l},${PAD.t + iH} Z`}
          fill="url(#area-src)"
        />
        <path
          d={`${toPath(cmpPts)} L${cmpPts[n-1].x},${PAD.t + iH} L${PAD.l},${PAD.t + iH} Z`}
          fill="url(#area-cmp)"
        />

        {/* Lines */}
        <path d={toPath(srcPts)} fill="none" stroke={T_HEX} strokeWidth="2.5" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${T_GLOW})` }} />
        <path d={toPath(cmpPts)} fill="none" stroke={C_HEX} strokeWidth="2.5" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${C_GLOW})` }} />

        {/* Dots */}
        {entries.map((e, i) => {
          const sx = srcPts[i].x, sy = srcPts[i].y;
          const cx = cmpPts[i].x, cy = cmpPts[i].y;
          const isLast = i === n - 1;
          return (
            <g key={i}>
              <circle cx={sx} cy={sy} r={isLast ? 5 : 3.5} fill={T_HEX}
                stroke="rgba(17,24,39,0.9)" strokeWidth="1.5"
                style={{ filter: isLast ? `drop-shadow(0 0 8px ${T_GLOW})` : 'none' }} />
              <circle cx={cx} cy={cy} r={isLast ? 5 : 3.5} fill={C_HEX}
                stroke="rgba(17,24,39,0.9)" strokeWidth="1.5"
                style={{ filter: isLast ? `drop-shadow(0 0 8px ${C_GLOW})` : 'none' }} />
              {/* X tick */}
              <text x={sx} y={CH - 8} textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize="8" fontFamily="monospace">
                {fmtDate(e.timestamp)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Gap Evolution */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${DIVIDER}` }}>
        <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: lastDelta >= 0 ? T_HEX : C_HEX }} />
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span style={{ color: 'rgba(255,255,255,0.50)' }}>Gap Evolution:</span>
          {lastDelta === 0 ? (
            <span style={{ color: 'rgba(255,255,255,0.50)' }}>Tied</span>
          ) : (
            <span style={{ color: lastDelta > 0 ? T_HEX : C_HEX, fontWeight: 700 }}>
              {lastDelta > 0 ? 'You are' : 'Rival is'}{' '}
              <strong>{Math.abs(lastDelta)} pts</strong>{' '}
              {lastDelta > 0 ? 'ahead' : 'ahead'}
            </span>
          )}
          {deltaChange !== 0 && (
            <span className="flex items-center gap-0.5" style={{ color: deltaChange > 0 ? OK_CLR : REG_CLR }}>
              {deltaChange > 0
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {deltaChange > 0 ? `+${deltaChange}` : deltaChange} pts vs previous run
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Split Card (detail view) ────────────────────────────────────────────────

function SplitCards({ entry }: { entry: CompareEntry }) {
  const sides: { key: 'source' | 'competitor'; label: string; accent: string; glow: string }[] = [
    { key: 'source',     label: 'Your Site',  accent: T_HEX, glow: T_GLOW },
    { key: 'competitor', label: 'Competitor', accent: C_HEX, glow: C_GLOW },
  ];
  const metrics: { label: string; key: string; fmt: (v: number) => string }[] = [
    { label: 'LCP',   key: 'lcp', fmt: fmtMs },
    { label: 'TBT',   key: 'tbt', fmt: fmtMs },
    { label: 'FCP',   key: 'fcp', fmt: fmtMs },
    { label: 'CLS',   key: 'cls', fmt: v => v.toFixed(3) },
    { label: 'TTI',   key: 'tti', fmt: fmtMs },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {sides.map(({ key, label, accent, glow }) => {
        const data    = entry[key];
        const sc      = Math.round(data.scores['performance'] ?? 0);
        const isWinner = entry.winner === key;
        return (
          <div key={key} className="rounded-xl p-4 space-y-3"
            style={{
              background: `${accent}08`,
              border:     `1px solid ${accent}22`,
              boxShadow:  isWinner ? `0 0 24px ${glow.replace('0.55', '0.15')}` : 'none',
            }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                  {label}
                </span>
              </div>
              {isWinner && (
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
              )}
            </div>
            <div className="text-center py-1">
              <span className="text-[2rem] font-black tabular-nums"
                style={{ color: isWinner ? '#ffffff' : 'rgba(255,255,255,0.65)',
                  textShadow: isWinner ? `0 0 20px ${glow}` : 'none' }}>
                {sc}
              </span>
              <span className="text-[11px] ml-1" style={{ color: 'rgba(255,255,255,0.30)' }}>/100</span>
            </div>
            <div className="space-y-1.5">
              {metrics.map(({ label: ml, key: mk, fmt }) => (
                <div key={mk} className="flex items-center justify-between text-[11px]">
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>{ml}</span>
                  <span className="font-mono font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {fmt(data.metrics[mk] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Pair Detail Panel ────────────────────────────────────────────────────────

function PairDetail({ pairId, onClose }: { pairId: string; onClose: () => void }) {
  const { data: entries = [], isLoading } = useCompareHistoryPair(pairId);
  const last = entries[entries.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25 }}
      style={PANEL}
    >
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
        <div className="flex items-center gap-2">
          <GitCompareArrows className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>
            Pair Detail
          </span>
          <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
            {pairId}
          </span>
        </div>
        <button onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
          <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.50)' }} />
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: `${T_HEX}30`, borderTopColor: T_HEX }} />
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="px-6 py-5 space-y-6">
          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px]">
            {[{ color: T_HEX, glow: T_GLOW, label: last.sourceHostname },
              { color: C_HEX, glow: C_GLOW, label: last.targetHostname }].map(({ color, glow, label }) => (
              <span key={label} className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <span className="w-4 h-0.5 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${glow}` }} />
                {label}
              </span>
            ))}
          </div>

          {/* Dual trend chart */}
          {entries.length >= 2
            ? <DualTrendChart entries={entries} />
            : <p className="text-[11px] text-center py-4" style={{ color: 'rgba(255,255,255,0.30)' }}>
                Run this comparison again to see trend data.
              </p>
          }

          {/* Last run split view */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-3"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              Latest Run · {fmtDateFull(last.timestamp)}
            </p>
            <SplitCards entry={last} />
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Archive Table ────────────────────────────────────────────────────────────

function WinnerBadge({ winner }: { winner: CompareEntry['winner'] }) {
  if (winner === 'tie') return (
    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.30)' }}>
      <Minus className="w-2.5 h-2.5" /> Tie
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.30)', color: '#fbbf24' }}>
      <Trophy className="w-2.5 h-2.5" />
      {winner === 'source' ? 'You win' : 'Rival wins'}
    </span>
  );
}

function ArchiveTable({
  entries, selectedPair, onSelect,
}: {
  entries: CompareEntry[];
  selectedPair: string | null;
  onSelect: (pairId: string) => void;
}) {
  return (
    <div style={PANEL}>
      <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
        <History className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>All Comparisons</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
          {entries.length} pair{entries.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${DIVIDER}` }}>
              {['Your Site', 'Competitor', 'Score (You)', 'Score (Rival)', 'Delta', 'Winner', 'Last Run', ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.25)', textAlign: i >= 2 ? 'center' : 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout" initial={false}>
              {entries.length === 0 ? (
                <motion.tr key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td colSpan={8} className="px-6 py-12 text-center text-[12px]"
                    style={{ color: 'rgba(255,255,255,0.25)' }}>
                    No comparisons match your search.
                  </td>
                </motion.tr>
              ) : (
                entries.map((e, i) => {
                  const src  = score(e, 'source');
                  const cmp  = score(e, 'competitor');
                  const delta = src - cmp;
                  const isSelected = selectedPair === e.pairId;
                  return (
                    <motion.tr
                      key={e.pairId}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.16, delay: i * 0.03 }}
                      onClick={() => onSelect(e.pairId)}
                      style={{
                        borderBottom: `1px solid ${DIVIDER}`,
                        background: isSelected
                          ? 'rgba(139,92,246,0.08)'
                          : i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent',
                        cursor: 'pointer',
                        borderLeft: isSelected ? `2px solid ${T_HEX}` : '2px solid transparent',
                      }}
                      onMouseEnter={e2 => { if (!isSelected) (e2.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e2 => { if (!isSelected) (e2.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent'; }}
                    >
                      {/* Your Site */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: T_HEX }} />
                          <span className="font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>
                            {e.sourceHostname}
                          </span>
                        </div>
                      </td>
                      {/* Competitor */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C_HEX }} />
                          <span className="font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>
                            {e.targetHostname}
                          </span>
                        </div>
                      </td>
                      {/* Score source */}
                      <td className="px-4 py-3 text-center">
                        <span className="font-black tabular-nums text-[14px]"
                          style={{ color: e.winner === 'source' ? '#ffffff' : 'rgba(255,255,255,0.55)',
                            textShadow: e.winner === 'source' ? `0 0 12px ${T_GLOW}` : 'none' }}>
                          {src}
                        </span>
                      </td>
                      {/* Score competitor */}
                      <td className="px-4 py-3 text-center">
                        <span className="font-black tabular-nums text-[14px]"
                          style={{ color: e.winner === 'competitor' ? '#ffffff' : 'rgba(255,255,255,0.55)',
                            textShadow: e.winner === 'competitor' ? `0 0 12px ${C_GLOW}` : 'none' }}>
                          {cmp}
                        </span>
                      </td>
                      {/* Delta */}
                      <td className="px-4 py-3 text-center">
                        <span className="flex items-center justify-center gap-0.5 text-[11px] font-bold"
                          style={{ color: delta > 0 ? T_HEX : delta < 0 ? C_HEX : 'rgba(255,255,255,0.30)' }}>
                          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      </td>
                      {/* Winner */}
                      <td className="px-4 py-3 text-center">
                        <WinnerBadge winner={e.winner} />
                      </td>
                      {/* Date */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-[10px]"
                          style={{ color: 'rgba(255,255,255,0.35)' }}>
                          <Clock className="w-3 h-3" />
                          {fmtDate(e.timestamp)}
                        </div>
                      </td>
                      {/* Arrow */}
                      <td className="px-3 py-3">
                        <ChevronRight className="w-3.5 h-3.5 transition-transform"
                          style={{ color: isSelected ? T_HEX : 'rgba(255,255,255,0.20)',
                            transform: isSelected ? 'rotate(90deg)' : 'none' }} />
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.25)' }} />
      <input
        type="text"
        placeholder="Search by rival URL…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[12px] outline-none transition-all"
        style={{
          background:   'rgba(255,255,255,0.04)',
          border:       '1px solid rgba(255,255,255,0.10)',
          color:        '#e2e8f0',
        }}
        onFocus={e => { e.currentTarget.style.border = `1px solid ${T_HEX}50`; e.currentTarget.style.boxShadow = `0 0 0 3px ${T_HEX}10`; }}
        onBlur={e  => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none'; }}
      />
      {value && (
        <button onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'rgba(255,255,255,0.30)' }}>
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.20)' }}>
        <GitCompareArrows className="w-7 h-7" style={{ color: T_HEX, opacity: 0.7 }} />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>No comparisons yet</p>
        <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Run a competitive analysis to start tracking performance battles.
        </p>
      </div>
      <Link to="/compare"
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold mt-1 transition-all"
        style={{ background: 'rgba(139,92,246,0.12)', border: `1px solid rgba(139,92,246,0.28)`, color: T_HEX }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.20)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}>
        <GitCompareArrows className="w-3.5 h-3.5" />
        Go to Compare
      </Link>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CompareHistoryPage() {
  const [params, setParams] = useSearchParams();
  const search      = params.get('search') ?? '';
  const selectedPair = params.get('pair');

  const { data: pairs = [], isLoading } = useCompareHistoryList(search);

  function setSearch(v: string) {
    setParams(p => { const n = new URLSearchParams(p); v ? n.set('search', v) : n.delete('search'); n.delete('pair'); return n; }, { replace: true });
  }
  function setPair(pairId: string) {
    setParams(p => {
      const n = new URLSearchParams(p);
      if (n.get('pair') === pairId) n.delete('pair'); else n.set('pair', pairId);
      return n;
    }, { replace: true });
  }
  function closePair() {
    setParams(p => { const n = new URLSearchParams(p); n.delete('pair'); return n; }, { replace: true });
  }

  // Debounced search: update URL after input change
  const [localSearch, setLocalSearch] = useState(search);
  useMemo(() => { setLocalSearch(search); }, [search]);

  function handleSearch(v: string) {
    setLocalSearch(v);
    const t = setTimeout(() => setSearch(v), 300);
    return () => clearTimeout(t);
  }

  return (
    <div className="relative min-h-screen" style={{ background: PAGE_BG }}>
      <div className="pointer-events-none fixed top-0 left-0 w-[600px] h-[600px]"
        style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(139,92,246,0.11) 0%, transparent 62%)', zIndex: 0 }} />
      <div className="pointer-events-none fixed bottom-0 right-0 w-[600px] h-[600px]"
        style={{ background: 'radial-gradient(ellipse at 100% 100%, rgba(245,158,11,0.08) 0%, transparent 62%)', zIndex: 0 }} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 py-8 space-y-6">
        <Breadcrumb />

        <div className="max-w-sm">
          <SearchBar value={localSearch} onChange={handleSearch} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-28">
            <div className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: `${T_HEX}30`, borderTopColor: T_HEX }} />
          </div>
        ) : pairs.length === 0 && !search ? (
          <EmptyState />
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-6"
            >
              <ArchiveTable entries={pairs} selectedPair={selectedPair} onSelect={setPair} />
              <AnimatePresence>
                {selectedPair && (
                  <PairDetail key={selectedPair} pairId={selectedPair} onClose={closePair} />
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
