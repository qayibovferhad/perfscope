import { useState, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompareArrows, Trophy, Clock, Search, TrendingUp, TrendingDown,
  Minus, ChevronRight, X, Zap, History, FileDown, Lightbulb,
} from 'lucide-react';
import { useCompareHistoryList, useCompareHistoryPair, type CompareEntry } from '../model/useCompareHistory';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  background:           'var(--ps-panel-bg)',
  backdropFilter:       'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border:               '1px solid var(--ps-panel-border)',
  borderRadius:         '1rem',
  overflow:             'hidden',
};
const DIVIDER = 'var(--ps-divider)';
const T_HEX   = 'var(--ps-accent)';
const T_GLOW  = 'var(--ps-accent-glow-lg)';
const C_HEX   = 'var(--ps-amber)';
const C_GLOW  = 'var(--ps-amber-glow)';
const OK_CLR  = 'var(--ps-healthy)';
const REG_CLR = 'var(--ps-regression)';

// ─── Metric system ────────────────────────────────────────────────────────────

type MetricKey = 'score' | 'lcp' | 'tbt' | 'cls';

interface MetricDef {
  label:         string;
  unit:          string;
  accent:        string;
  lowerIsBetter: boolean;
  getValue:      (e: CompareEntry, side: 'source' | 'competitor') => number;
  fmt:           (v: number) => string;
  yFmt:          (v: number) => string;
}

const METRIC_DEFS: Record<MetricKey, MetricDef> = {
  score: {
    label: 'Score', unit: 'pts', accent: '#8B5CF6', lowerIsBetter: false,
    getValue: (e, s) => Math.round(e[s].scores['performance'] ?? 0),
    fmt:  v => `${Math.round(v)}`,
    yFmt: v => Math.round(v).toString(),
  },
  lcp: {
    label: 'LCP', unit: 's', accent: '#10b981', lowerIsBetter: true,
    getValue: (e, s) => e[s].metrics['lcp'] ?? 0,
    fmt:  v => v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`,
    yFmt: v => v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`,
  },
  tbt: {
    label: 'TBT', unit: 'ms', accent: '#f97316', lowerIsBetter: true,
    getValue: (e, s) => e[s].metrics['tbt'] ?? 0,
    fmt:  v => `${Math.round(v)}ms`,
    yFmt: v => `${Math.round(v)}`,
  },
  cls: {
    label: 'CLS', unit: '', accent: '#ec4899', lowerIsBetter: true,
    getValue: (e, s) => e[s].metrics['cls'] ?? 0,
    fmt:  v => v.toFixed(3),
    yFmt: v => v.toFixed(2),
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDateFull(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function generateInsight(
  key: MetricKey, srcVal: number, cmpVal: number,
  srcHost: string, cmpHost: string,
): string {
  const def     = METRIC_DEFS[key];
  const diff    = srcVal - cmpVal;
  const srcWins = def.lowerIsBetter ? diff < 0 : diff > 0;
  const winner  = srcWins ? srcHost : cmpHost;
  const absDiff = Math.abs(diff);

  if (key === 'score') {
    const pts = Math.round(absDiff);
    if (pts < 2) return 'Both sites are virtually tied on performance score — the battle is perfectly balanced.';
    return `${winner} leads by ${pts} pts. ${srcWins ? 'Your' : "Competitor's"} advantage translates to ~${Math.min(pts * 2, 40)}% lower estimated bounce rate from performance alone.`;
  }
  if (key === 'lcp') {
    if (absDiff < 100) return 'LCP values are within margin of error — effectively tied on largest contentful paint.';
    const secs = (absDiff / 1000).toFixed(2);
    const risk = Math.min(Math.round(absDiff / 100) * 7, 35);
    return `${winner}'s LCP is ${secs}s faster — content appears sooner, reducing bounce rate risk by ~${risk}%. Google considers LCP under 2.5s "Good".`;
  }
  if (key === 'tbt') {
    if (absDiff < 20) return 'Total Blocking Time is comparable — no significant main-thread bottleneck difference.';
    return `${winner} has ${Math.round(absDiff)}ms less blocking time, directly improving INP and making interactions feel ${srcWins ? 'noticeably smoother on your site' : 'more sluggish on yours'}.`;
  }
  if (key === 'cls') {
    if (absDiff < 0.005) return 'Layout stability is essentially the same between both sites — no meaningful CLS difference.';
    return `${winner} is ${absDiff.toFixed(3)} CLS points more stable (${(absDiff * 100).toFixed(1)}% less shift), reducing ${srcWins ? 'your' : "competitor's"} visual instability that frustrates users mid-read.`;
  }
  return '';
}

// ─── Metric Toggle ────────────────────────────────────────────────────────────

function MetricToggle({ active, onChange }: { active: MetricKey; onChange: (k: MetricKey) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${DIVIDER}` }}>
      {(Object.entries(METRIC_DEFS) as [MetricKey, MetricDef][]).map(([key, def]) => {
        const isActive = active === key;
        return (
          <button key={key} onClick={() => onChange(key)}
            className="relative px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors duration-150"
            style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.35)' }}>
            {isActive && (
              <motion.div layoutId="metric-pill" className="absolute inset-0 rounded-lg"
                style={{ background: `${def.accent}22`, border: `1px solid ${def.accent}55`, boxShadow: `0 0 12px ${def.accent}30` }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
            <span className="relative z-10" style={{ color: isActive ? def.accent : 'rgba(255,255,255,0.35)' }}>
              {def.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Dual Trend Chart ─────────────────────────────────────────────────────────

const CW = 640; const CH = 180;
const PAD = { t: 16, r: 20, b: 48, l: 52 };

function DualTrendChart({ entries, metricKey }: { entries: CompareEntry[]; metricKey: MetricKey }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const n   = entries.length;
  const def = METRIC_DEFS[metricKey];
  if (n < 2) return null;

  const iW  = CW - PAD.l - PAD.r;
  const iH  = CH - PAD.t - PAD.b;
  const xOf = (i: number) => PAD.l + (i / (n - 1)) * iW;

  const srcVals = entries.map(e => def.getValue(e, 'source'));
  const cmpVals = entries.map(e => def.getValue(e, 'competitor'));
  const allVals = [...srcVals, ...cmpVals];
  const vMin    = Math.min(...allVals) * (def.lowerIsBetter ? 0.88 : 0.92);
  const vMax    = Math.max(...allVals) * 1.08;
  const yOf     = (v: number) => PAD.t + iH - ((v - vMin) / (vMax - vMin || 1)) * iH;
  const toPath  = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');

  const srcPath = toPath(srcVals);
  const cmpPath = toPath(cmpVals);
  const yTicks  = [0, 0.5, 1].map(t => ({ v: vMin + t * (vMax - vMin), y: PAD.t + iH * (1 - t) }));

  const tooltipPct = hoveredIdx !== null ? ((xOf(hoveredIdx) - PAD.l) / iW) * 100 : 0;
  const flipLeft   = tooltipPct > 55;

  return (
    <AnimatePresence mode="wait">
      <motion.div key={metricKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="relative">
        <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <defs>
            {[{ id: 'src', color: T_HEX }, { id: 'cmp', color: C_HEX }].map(({ id, color }) => (
              <linearGradient key={id} id={`area-${id}-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.14" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} y1={t.y} x2={CW - PAD.r} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fill="rgba(255,255,255,0.22)" fontSize="9" fontFamily="monospace">
                {def.yFmt(t.v)}
              </text>
            </g>
          ))}
          {hoveredIdx !== null && (
            <line x1={xOf(hoveredIdx)} y1={PAD.t} x2={xOf(hoveredIdx)} y2={PAD.t + iH}
              stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 3" />
          )}
          <path d={`${srcPath} L${xOf(n-1)},${PAD.t+iH} L${PAD.l},${PAD.t+iH} Z`} fill={`url(#area-src-${metricKey})`} />
          <path d={`${cmpPath} L${xOf(n-1)},${PAD.t+iH} L${PAD.l},${PAD.t+iH} Z`} fill={`url(#area-cmp-${metricKey})`} />
          <path d={srcPath} fill="none" stroke={T_HEX} strokeWidth="2.5" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px var(--ps-accent-glow-lg))' }} />
          <path d={cmpPath} fill="none" stroke={C_HEX} strokeWidth="2.5" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px var(--ps-amber-glow))' }} />
          {entries.map((e, i) => {
            const isHov = hoveredIdx === i, isLast = i === n - 1;
            const sx = xOf(i), sy = yOf(srcVals[i]), cx = xOf(i), cy = yOf(cmpVals[i]);
            return (
              <g key={i}>
                <circle cx={sx} cy={sy} r={isHov ? 6 : isLast ? 5.5 : 3.5} fill={T_HEX}
                  stroke="rgba(17,24,39,0.9)" strokeWidth="1.5"
                  style={{ filter: (isHov || isLast) ? 'drop-shadow(0 0 10px var(--ps-accent-glow-lg))' : 'none', transition: 'r 0.1s' }} />
                <circle cx={cx} cy={cy} r={isHov ? 6 : isLast ? 5.5 : 3.5} fill={C_HEX}
                  stroke="rgba(17,24,39,0.9)" strokeWidth="1.5"
                  style={{ filter: (isHov || isLast) ? 'drop-shadow(0 0 10px var(--ps-amber-glow))' : 'none', transition: 'r 0.1s' }} />
                <text x={sx} y={CH - 8} textAnchor="middle"
                  fill={isHov ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.20)'} fontSize="8" fontFamily="monospace">
                  {fmtDate(e.timestamp)}
                </text>
                <rect x={xOf(i) - (iW / n / 2)} y={PAD.t} width={iW / n} height={iH}
                  fill="transparent" style={{ cursor: 'crosshair' }}
                  onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} />
              </g>
            );
          })}
        </svg>
        <AnimatePresence>
          {hoveredIdx !== null && (() => {
            const e = entries[hoveredIdx];
            const srcVal = srcVals[hoveredIdx], cmpVal = cmpVals[hoveredIdx];
            const srcWins = def.lowerIsBetter ? srcVal < cmpVal : srcVal > cmpVal;
            return (
              <motion.div key={hoveredIdx} initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.12 }} className="absolute top-0 z-30 pointer-events-none"
                style={{ [flipLeft ? 'right' : 'left']: `calc(${flipLeft ? 100 - tooltipPct : tooltipPct}% + 12px)`, minWidth: 168 }}>
                <div className="rounded-xl px-3.5 py-3 text-[11px] space-y-2"
                  style={{ background: 'rgba(13,18,36,0.97)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <div className="flex items-center gap-1.5 pb-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="font-mono font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>{fmtDateFull(e.timestamp)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: T_HEX }} />{e.sourceHostname}
                    </span>
                    <span className="font-mono font-black tabular-nums"
                      style={{ color: srcWins ? T_HEX : 'rgba(255,255,255,0.70)', textShadow: srcWins ? `0 0 8px ${T_GLOW}` : 'none' }}>
                      {def.fmt(srcVal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: C_HEX }} />{e.targetHostname}
                    </span>
                    <span className="font-mono font-black tabular-nums"
                      style={{ color: !srcWins ? C_HEX : 'rgba(255,255,255,0.70)', textShadow: !srcWins ? `0 0 8px ${C_GLOW}` : 'none' }}>
                      {def.fmt(cmpVal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Delta</span>
                    <span className="font-mono font-bold text-[11px]" style={{ color: srcWins ? T_HEX : C_HEX }}>
                      {srcWins ? '-' : '+'}{def.fmt(Math.abs(srcVal - cmpVal))}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Insight Box ─────────────────────────────────────────────────────────────

function InsightBox({ entries, metricKey }: { entries: CompareEntry[]; metricKey: MetricKey }) {
  const def  = METRIC_DEFS[metricKey];
  const last = entries[entries.length - 1];
  const prev = entries.length >= 2 ? entries[entries.length - 2] : null;

  const srcVal  = def.getValue(last, 'source');
  const cmpVal  = def.getValue(last, 'competitor');
  const diff    = srcVal - cmpVal;
  const srcWins = def.lowerIsBetter ? diff < 0 : diff > 0;

  const deltas    = entries.map(e => { const s = def.getValue(e, 'source'), c = def.getValue(e, 'competitor'); return def.lowerIsBetter ? c - s : s - c; });
  const lastDelta  = deltas[deltas.length - 1];
  const prevDelta  = prev ? deltas[deltas.length - 2] : null;
  const deltaChange = prevDelta !== null ? lastDelta - prevDelta : 0;
  const insight = generateInsight(metricKey, srcVal, cmpVal, last.sourceHostname, last.targetHostname);

  return (
    <AnimatePresence mode="wait">
      <motion.div key={metricKey} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${DIVIDER}` }}>
          <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: srcWins ? T_HEX : C_HEX }} />
          <div className="flex items-center gap-2 flex-wrap text-[11px] flex-1">
            <span className="font-bold uppercase tracking-wider text-[9px]" style={{ color: 'rgba(255,255,255,0.30)' }}>Gap · {def.label}</span>
            {Math.abs(diff) < 0.001 ? (
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>Tied</span>
            ) : (
              <span style={{ color: srcWins ? T_HEX : C_HEX, fontWeight: 700 }}>
                {srcWins ? last.sourceHostname : last.targetHostname} is <strong>{def.fmt(Math.abs(diff))}</strong> {def.lowerIsBetter ? 'faster' : 'ahead'}
              </span>
            )}
            {deltaChange !== 0 && (
              <span className="flex items-center gap-0.5 ml-auto" style={{ color: deltaChange > 0 ? OK_CLR : REG_CLR }}>
                {deltaChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                Gap {deltaChange > 0 ? 'widening' : 'narrowing'} vs prev run
              </span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: `${def.accent}08`, border: `1px solid ${def.accent}22` }}>
          <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: def.accent }} />
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest block mb-1" style={{ color: def.accent }}>Senior Insight</span>
            <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.70)' }}>{insight}</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function generatePdf(ref: React.RefObject<HTMLDivElement | null>, sourceHostname: string, targetHostname: string) {
  if (!ref.current) return;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(ref.current, {
    scale: 2, backgroundColor: document.documentElement.classList.contains('dark') ? '#030712' : '#f1f5f9',
    useCORS: true, logging: false,
  });
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfW = pdf.internal.pageSize.getWidth(), pdfH = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(3, 7, 18); pdf.rect(0, 0, pdfW, pdfH, 'F');
  pdf.setFillColor(17, 24, 39); pdf.rect(0, 0, pdfW, 22, 'F');
  pdf.setTextColor(139, 92, 246); pdf.setFontSize(16); pdf.setFont('helvetica', 'bold'); pdf.text('PerfScope', 12, 14);
  pdf.setTextColor(203, 213, 225); pdf.setFontSize(9); pdf.setFont('helvetica', 'normal');
  pdf.text(`Competitive Analysis: ${sourceHostname} vs ${targetHostname}`, 12, 28);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, 12, 34);
  pdf.setDrawColor(139, 92, 246, 0.4); pdf.setLineWidth(0.3); pdf.line(12, 37, pdfW - 12, 37);
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const imgW = pdfW - 24, imgH = Math.min((canvas.height / canvas.width) * imgW, pdfH - 50);
  pdf.addImage(imgData, 'JPEG', 12, 42, imgW, imgH);
  pdf.setTextColor(75, 85, 99); pdf.setFontSize(7);
  pdf.text('Generated by PerfScope · Performance Intelligence Platform', 12, pdfH - 8);
  pdf.save(`perfscope-compare-${sourceHostname}-vs-${targetHostname}-${Date.now()}.pdf`);
}

// ─── Split Cards ─────────────────────────────────────────────────────────────

function SplitCards({ entry }: { entry: CompareEntry }) {
  const sides: { key: 'source' | 'competitor'; label: string; accent: string; glow: string }[] = [
    { key: 'source',     label: 'Your Site',  accent: T_HEX, glow: T_GLOW },
    { key: 'competitor', label: 'Competitor', accent: C_HEX, glow: C_GLOW },
  ];
  const metricRows: { label: string; mk: string; fmt: (v: number) => string }[] = [
    { label: 'LCP', mk: 'lcp', fmt: fmtMs },
    { label: 'TBT', mk: 'tbt', fmt: fmtMs },
    { label: 'FCP', mk: 'fcp', fmt: fmtMs },
    { label: 'CLS', mk: 'cls', fmt: v => v.toFixed(3) },
    { label: 'TTI', mk: 'tti', fmt: fmtMs },
  ];
  return (
    <div className="grid grid-cols-2 gap-4">
      {sides.map(({ key, label, accent, glow }) => {
        const data = entry[key];
        const sc   = Math.round(data.scores['performance'] ?? 0);
        const isWinner = entry.winner === key;
        return (
          <div key={key} className="rounded-xl p-4 space-y-3"
            style={{ background: `${accent}08`, border: `1px solid ${accent}22`, boxShadow: isWinner ? `0 0 24px ${glow.replace('0.55', '0.12')}` : 'none' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>{label}</span>
              </div>
              {isWinner && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
            </div>
            <div className="text-center py-1">
              <span className="text-[2rem] font-black tabular-nums"
                style={{ color: isWinner ? '#ffffff' : 'rgba(255,255,255,0.60)', textShadow: isWinner ? `0 0 20px ${glow}` : 'none' }}>
                {sc}
              </span>
              <span className="text-[11px] ml-1" style={{ color: 'rgba(255,255,255,0.28)' }}>/100</span>
            </div>
            <div className="space-y-1.5">
              {metricRows.map(({ label: ml, mk, fmt }) => (
                <div key={mk} className="flex items-center justify-between text-[11px]">
                  <span style={{ color: 'rgba(255,255,255,0.33)' }}>{ml}</span>
                  <span className="font-mono font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.72)' }}>{fmt(data.metrics[mk] ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Pair Detail ─────────────────────────────────────────────────────────────

function PairDetail({ pairId, onClose }: { pairId: string; onClose: () => void }) {
  const { data: entries = [], isLoading } = useCompareHistoryPair(pairId);
  const [activeMetric, setActiveMetric]  = useState<MetricKey>('score');
  const [exporting, setExporting]        = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const last = entries[entries.length - 1];

  async function handleExport() {
    if (!last) return;
    setExporting(true);
    try { await generatePdf(reportRef, last.sourceHostname, last.targetHostname); }
    finally { setExporting(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }} style={PANEL}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
        <div className="flex items-center gap-2">
          <GitCompareArrows className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>Pair Detail</span>
          <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{pairId}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && entries.length > 0 && (
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ps-btn-ghost disabled:opacity-40">
              <FileDown className="w-3 h-3" />{exporting ? 'Generating…' : 'Generate Report'}
            </button>
          )}
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
            <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.45)' }} />
          </button>
        </div>
      </div>
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: `${T_HEX}30`, borderTopColor: T_HEX }} />
        </div>
      )}
      {!isLoading && entries.length > 0 && (
        <div ref={reportRef} className="px-6 py-5 space-y-6">
          <div className="flex items-center gap-4 text-[10px]">
            {[
              { color: T_HEX, glow: T_GLOW, label: last.sourceHostname, note: 'Your Site' },
              { color: C_HEX, glow: C_GLOW, label: last.targetHostname, note: 'Competitor' },
            ].map(({ color, glow, label, note }) => (
              <span key={label} className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <span className="w-4 h-0.5 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${glow}` }} />
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</span>
                <span style={{ color: 'rgba(255,255,255,0.28)' }}>({note})</span>
              </span>
            ))}
          </div>
          {entries.length >= 2 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Performance Trend · {entries.length} runs
                </span>
                <MetricToggle active={activeMetric} onChange={setActiveMetric} />
              </div>
              <DualTrendChart entries={entries} metricKey={activeMetric} />
              <InsightBox entries={entries} metricKey={activeMetric} />
            </div>
          ) : (
            <p className="text-[11px] text-center py-4" style={{ color: 'rgba(255,255,255,0.28)' }}>
              Run this comparison again to unlock trend analysis.
            </p>
          )}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.22)' }}>
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
      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.28)' }}>
      <Minus className="w-2.5 h-2.5" /> Tie
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.30)', color: '#fbbf24' }}>
      <Trophy className="w-2.5 h-2.5" />{winner === 'source' ? 'You win' : 'Rival wins'}
    </span>
  );
}

function ArchiveTable({ entries, selectedPair, onSelect }: {
  entries: CompareEntry[]; selectedPair: string | null; onSelect: (id: string) => void;
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
      <div className="overflow-x-auto" style={{ overflowX: 'clip' }}>
        <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${DIVIDER}` }}>
              {['Your Site', 'Competitor', 'Score (You)', 'Score (Rival)', 'Delta', 'Winner', 'Last Run', ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.22)', textAlign: i >= 2 ? 'center' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout" initial={false}>
              {entries.length === 0 ? (
                <motion.tr key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td colSpan={8} className="px-6 py-12 text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    No comparisons match your search.
                  </td>
                </motion.tr>
              ) : entries.map((e, i) => {
                const srcScore = Math.round(e.source.scores['performance'] ?? 0);
                const cmpScore = Math.round(e.competitor.scores['performance'] ?? 0);
                const delta    = srcScore - cmpScore;
                const isSel    = selectedPair === e.pairId;
                return (
                  <motion.tr key={e.pairId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }} transition={{ duration: 0.14 }}
                    onClick={() => onSelect(e.pairId)}
                    style={{
                      borderBottom: `1px solid ${DIVIDER}`,
                      borderLeft:   `2px solid ${isSel ? T_HEX : 'transparent'}`,
                      background:   isSel ? 'var(--ps-accent-muted)' : i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={ev => { if (!isSel) (ev.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={ev => { if (!isSel) (ev.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent'; }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: T_HEX }} />
                        <span className="font-mono" style={{ color: 'rgba(255,255,255,0.72)' }}>{e.sourceHostname}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C_HEX }} />
                        <span className="font-mono" style={{ color: 'rgba(255,255,255,0.72)' }}>{e.targetHostname}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-black tabular-nums text-[14px]"
                        style={{ color: e.winner === 'source' ? '#ffffff' : 'rgba(255,255,255,0.50)', textShadow: e.winner === 'source' ? `0 0 12px ${T_GLOW}` : 'none' }}>
                        {srcScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-black tabular-nums text-[14px]"
                        style={{ color: e.winner === 'competitor' ? '#ffffff' : 'rgba(255,255,255,0.50)', textShadow: e.winner === 'competitor' ? `0 0 12px ${C_GLOW}` : 'none' }}>
                        {cmpScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-0.5 text-[11px] font-bold"
                        style={{ color: delta > 0 ? T_HEX : delta < 0 ? C_HEX : 'rgba(255,255,255,0.28)' }}>
                        {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center"><WinnerBadge winner={e.winner} /></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.32)' }}>
                        <Clock className="w-3 h-3" />{fmtDate(e.timestamp)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <ChevronRight className="w-3.5 h-3.5 transition-transform"
                        style={{ color: isSel ? T_HEX : 'rgba(255,255,255,0.18)', transform: isSel ? 'rotate(90deg)' : 'none' }} />
                    </td>
                  </motion.tr>
                );
              })}
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
    <div className="relative max-w-sm">
      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.25)' }} />
      <input type="text" placeholder="Search by rival URL…" value={value} onChange={e => onChange(e.target.value)}
        className="w-full pl-9 pr-8 py-2.5 rounded-xl text-[12px] outline-none transition-all"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0' }}
        onFocus={e => { e.currentTarget.style.border = `1px solid ${T_HEX}50`; e.currentTarget.style.boxShadow = `0 0 0 3px ${T_HEX}10`; }}
        onBlur={e  => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none'; }} />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'rgba(255,255,255,0.28)' }}>
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
        style={{ background: 'var(--ps-accent-muted)', border: '1px solid var(--ps-accent-border)' }}>
        <GitCompareArrows className="w-7 h-7" style={{ color: T_HEX, opacity: 0.7 }} />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>No comparisons yet</p>
        <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.33)' }}>
          Run a competitive analysis to start tracking performance battles.
        </p>
      </div>
      <Link to="/compare" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold mt-1 transition-all ps-btn-ghost">
        <GitCompareArrows className="w-3.5 h-3.5" /> Go to Compare
      </Link>
    </motion.div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function CompareHistoryPanel() {
  const [params, setParams] = useSearchParams();
  const search       = params.get('search') ?? '';
  const selectedPair = params.get('pair');
  const [localSearch, setLocalSearch] = useState(search);

  const { data: pairs = [], isLoading } = useCompareHistoryList(search);

  useMemo(() => { setLocalSearch(search); }, [search]);

  function handleSearch(v: string) {
    setLocalSearch(v);
    const timer = setTimeout(() => {
      setParams(p => {
        const n = new URLSearchParams(p);
        v ? n.set('search', v) : n.delete('search');
        n.delete('pair');
        return n;
      }, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }

  function handleSelect(pairId: string) {
    setParams(p => {
      const n = new URLSearchParams(p);
      n.get('pair') === pairId ? n.delete('pair') : n.set('pair', pairId);
      return n;
    }, { replace: true });
  }

  function closePair() {
    setParams(p => { const n = new URLSearchParams(p); n.delete('pair'); return n; }, { replace: true });
  }

  return (
    <div className="space-y-6">
      <SearchBar value={localSearch} onChange={handleSearch} />
      {isLoading ? (
        <div className="flex items-center justify-center py-28">
          <div className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: `${T_HEX}30`, borderTopColor: T_HEX }} />
        </div>
      ) : pairs.length === 0 && !search ? <EmptyState /> : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }} className="space-y-6">
          <ArchiveTable entries={pairs} selectedPair={selectedPair} onSelect={handleSelect} />
          <AnimatePresence>
            {selectedPair && <PairDetail key={selectedPair} pairId={selectedPair} onClose={closePair} />}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
