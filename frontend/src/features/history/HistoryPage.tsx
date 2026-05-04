import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, TrendingUp, TrendingDown, Minus,
  Download, FileText, Clock, GitCommit, AlertTriangle,
  CheckCircle2, Activity, ChevronUp, ChevronDown, ChevronsUpDown,
  Filter,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { useHistory, type HistoryEntry } from './hooks/useHistory';
import { RegressionHistory } from './components/RegressionHistory';

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
const T_HEX   = '#8B5CF6';
const T_GLOW  = 'rgba(139,92,246,0.55)';
const C_HEX   = '#F59E0B';
const REG_CLR  = '#ef4444';
const REG_GLOW = 'rgba(239,68,68,0.55)';
const OK_CLR   = '#10b981';
const THRESHOLD = 15;

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'regression' | 'improved' | 'stable';
type SortKey      = 'date' | 'score' | 'lcp' | 'tbt' | 'cls' | 'fcp' | 'tti';
type SortOrder    = 'asc' | 'desc';
type RowStatus    = 'baseline' | 'regression' | 'improved' | 'stable';

interface RowData {
  entry:  HistoryEntry;
  prev:   HistoryEntry | null;
  status: RowStatus;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMs  = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
const fmtCls = (v: number)  => v.toFixed(3);
const fmtPct = (n: number)  => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

function deltaPct(curr: number, prev: number) {
  return !prev ? 0 : ((curr - prev) / prev) * 100;
}
function isReg(curr: number, prev: number) {
  return deltaPct(curr, prev) > THRESHOLD;
}
function fmtDateFull(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function computeRows(entries: HistoryEntry[]): RowData[] {
  return entries.map((entry, i) => {
    const prev = i > 0 ? entries[i - 1] : null;
    let status: RowStatus = 'baseline';
    if (prev) {
      if (isReg(entry.metrics.lcp, prev.metrics.lcp) || isReg(entry.metrics.tbt, prev.metrics.tbt))
        status = 'regression';
      else if (entry.scores.performance > prev.scores.performance + 2)
        status = 'improved';
      else
        status = 'stable';
    }
    return { entry, prev, status };
  });
}

function sortRows(rows: RowData[], key: SortKey, order: SortOrder): RowData[] {
  return [...rows].sort((a, b) => {
    let av = 0, bv = 0;
    if (key === 'date')  { av = new Date(a.entry.timestamp).getTime(); bv = new Date(b.entry.timestamp).getTime(); }
    if (key === 'score') { av = a.entry.scores.performance;  bv = b.entry.scores.performance; }
    if (key === 'lcp')   { av = a.entry.metrics.lcp;  bv = b.entry.metrics.lcp; }
    if (key === 'tbt')   { av = a.entry.metrics.tbt;  bv = b.entry.metrics.tbt; }
    if (key === 'cls')   { av = a.entry.metrics.cls;  bv = b.entry.metrics.cls; }
    if (key === 'fcp')   { av = a.entry.metrics.fcp;  bv = b.entry.metrics.fcp; }
    if (key === 'tti')   { av = a.entry.metrics.tti;  bv = b.entry.metrics.tti; }
    return order === 'asc' ? av - bv : bv - av;
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

function exportJson(entries: HistoryEntry[], url: string) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `perfscope-history-${new URL(url).hostname}-${Date.now()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
function exportCsv(entries: HistoryEntry[], url: string) {
  const header = 'Date,Commit,Score,LCP(ms),TBT(ms),CLS,FCP(ms),TTI(ms)';
  const rows   = entries.map(e =>
    [new Date(e.timestamp).toISOString(), e.shortId, e.scores.performance,
     e.metrics.lcp, e.metrics.tbt, e.metrics.cls.toFixed(3), e.metrics.fcp, e.metrics.tti].join(','),
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `perfscope-history-${new URL(url).hostname}-${Date.now()}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ hostname }: { hostname: string }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm select-none">
      <Link
        to="/"
        className="flex items-center gap-1 font-medium transition-all duration-150"
        style={{ color: 'rgba(255,255,255,0.45)' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = T_HEX;
          (e.currentTarget as HTMLElement).style.textShadow = `0 0 12px ${T_GLOW}`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
          (e.currentTarget as HTMLElement).style.textShadow = 'none';
        }}
      >
        Analyzer
      </Link>
      <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '16px' }}>›</span>
      {hostname && (
        <>
          <span className="font-mono text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{hostname}</span>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '16px' }}>›</span>
        </>
      )}
      <div className="flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" style={{ color: T_HEX }} />
        <span className="font-semibold" style={{ color: '#e2e8f0' }}>Performance History</span>
      </div>
    </nav>
  );
}

// ─── Score Sparkline ─────────────────────────────────────────────────────────

function ScoreSparkline({ entries }: { entries: HistoryEntry[] }) {
  const scores = entries.map(e => e.scores.performance);
  const min = Math.min(...scores), max = Math.max(...scores);
  const W = 120, H = 32;
  const xOf = (i: number) => scores.length === 1 ? W / 2 : (i / (scores.length - 1)) * W;
  const yOf = (v: number) => H - 4 - ((v - min) / (max - min || 1)) * (H - 8);
  const path = scores.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  const last = scores[scores.length - 1];
  const prev = scores.length >= 2 ? scores[scores.length - 2] : undefined;
  const trend = prev === undefined ? 0 : last - prev;

  return (
    <div className="flex items-center gap-3">
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <path d={path} fill="none" stroke={T_HEX} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px rgba(139,92,246,0.5))` }} />
        <circle cx={xOf(scores.length - 1)} cy={yOf(last)} r="3.5"
          fill={T_HEX} stroke="rgba(17,24,39,0.9)" strokeWidth="1.5"
          style={{ filter: `drop-shadow(0 0 6px rgba(139,92,246,0.7))` }} />
      </svg>
      <div className="flex flex-col">
        <span className="text-[22px] font-black tabular-nums leading-none" style={{ color: '#e2e8f0' }}>
          {Math.round(last)}
        </span>
        <span className="text-[10px] flex items-center gap-0.5 mt-0.5"
          style={{ color: trend > 0 ? OK_CLR : trend < 0 ? REG_CLR : 'rgba(255,255,255,0.35)' }}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {trend !== 0 ? `${trend > 0 ? '+' : ''}${Math.round(trend)} pts` : 'stable'}
        </span>
      </div>
    </div>
  );
}

// ─── Page Header ─────────────────────────────────────────────────────────────

function PageHeader({ url, entries }: { url: string; entries: HistoryEntry[] }) {
  const hostname = (() => { try { return new URL(url).hostname; } catch { return url; } })();
  const regCount = useMemo(() => {
    let n = 0;
    for (let i = 1; i < entries.length; i++)
      if (isReg(entries[i].metrics.lcp, entries[i-1].metrics.lcp) || isReg(entries[i].metrics.tbt, entries[i-1].metrics.tbt)) n++;
    return n;
  }, [entries]);

  return (
    <div style={PANEL}>
      <div className="px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <Globe className="w-5 h-5" style={{ color: T_HEX }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold" style={{ color: '#e2e8f0' }}>{hostname}</h1>
              {regCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.12)', border: `1px solid rgba(239,68,68,0.30)`, color: REG_CLR }}>
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {regCount} regression{regCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5 font-mono truncate max-w-[420px]"
              style={{ color: 'rgba(255,255,255,0.28)' }}>{url}</p>
            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.20)' }}>
              {entries.length} run{entries.length !== 1 ? 's' : ''} tracked · max 10
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.22)' }}>Performance Score</span>
            <ScoreSparkline entries={entries} />
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => exportJson(entries, url)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)', color: T_HEX }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.20)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.10)')}>
              <Download className="w-3 h-3" /> Export JSON
            </button>
            <button onClick={() => exportCsv(entries, url)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', color: C_HEX }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.16)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.08)')}>
              <FileText className="w-3 h-3" /> Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const STATUS_OPTS: { value: StatusFilter; label: string; color?: string; border?: string; bg?: string }[] = [
  { value: 'all',        label: 'All'        },
  { value: 'regression', label: 'Regression', color: REG_CLR, border: 'rgba(239,68,68,0.35)', bg: 'rgba(239,68,68,0.10)' },
  { value: 'improved',   label: 'Improved',   color: OK_CLR,  border: 'rgba(16,185,129,0.35)', bg: 'rgba(16,185,129,0.10)' },
  { value: 'stable',     label: 'Stable'     },
];

function FilterBar({
  rows, status, onStatus,
}: {
  rows: RowData[];
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: rows.length, regression: 0, improved: 0, stable: 0 };
    for (const r of rows) {
      if (r.status === 'regression') c.regression++;
      else if (r.status === 'improved') c.improved++;
      else c.stable++;
    }
    return c;
  }, [rows]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 mr-1">
        <Filter className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.30)' }} />
        <span className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.30)' }}>Status</span>
      </div>
      {STATUS_OPTS.map(opt => {
        const active = status === opt.value;
        const count  = counts[opt.value];
        return (
          <button
            key={opt.value}
            onClick={() => onStatus(opt.value)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150"
            style={{
              background: active
                ? (opt.bg ?? 'rgba(139,92,246,0.15)')
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active
                ? (opt.border ?? 'rgba(139,92,246,0.40)')
                : 'rgba(255,255,255,0.08)'}`,
              color: active
                ? (opt.color ?? T_HEX)
                : 'rgba(255,255,255,0.40)',
              boxShadow: active && opt.color
                ? `0 0 12px ${opt.color}25`
                : active
                ? `0 0 12px ${T_GLOW.replace('0.55', '0.20')}`
                : 'none',
            }}
          >
            {opt.label}
            <span
              className="text-[9px] px-1.5 py-0 rounded-full tabular-nums"
              style={{
                background: active ? (opt.color ? `${opt.color}20` : 'rgba(139,92,246,0.20)') : 'rgba(255,255,255,0.06)',
                color: active ? (opt.color ?? T_HEX) : 'rgba(255,255,255,0.25)',
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RowStatus }) {
  if (status === 'baseline') return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.28)' }}>
      Baseline
    </span>
  );
  if (status === 'regression') return (
    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(239,68,68,0.12)', border: `1px solid rgba(239,68,68,0.28)`, color: REG_CLR }}>
      <AlertTriangle className="w-2.5 h-2.5" /> Regression
    </span>
  );
  if (status === 'improved') return (
    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', color: OK_CLR }}>
      <CheckCircle2 className="w-2.5 h-2.5" /> Improved
    </span>
  );
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.28)' }}>
      Stable
    </span>
  );
}

// ─── Metric Cell ──────────────────────────────────────────────────────────────

function MetricCell({ curr, prev, fmt, lowerIsBetter = true }: {
  curr: number; prev: number | null; fmt: (v: number) => string; lowerIsBetter?: boolean;
}) {
  const reg = prev !== null && (lowerIsBetter ? isReg(curr, prev) : isReg(prev, curr));
  const pct = prev !== null ? deltaPct(curr, prev) : null;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[12px] font-bold tabular-nums"
        style={{ color: reg ? REG_CLR : 'rgba(255,255,255,0.80)', textShadow: reg ? `0 0 8px ${REG_GLOW}` : 'none' }}>
        {fmt(curr)}
      </span>
      {pct !== null && (
        <span className="text-[9px] tabular-nums"
          style={{ color: reg ? REG_CLR : pct < -3 ? OK_CLR : 'rgba(255,255,255,0.20)' }}>
          {fmtPct(pct)}
        </span>
      )}
    </div>
  );
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({ col, sort, order }: { col: SortKey; sort: SortKey; order: SortOrder }) {
  if (col !== sort) return <ChevronsUpDown className="w-3 h-3 opacity-25" />;
  return order === 'asc'
    ? <ChevronUp className="w-3 h-3" style={{ color: T_HEX }} />
    : <ChevronDown className="w-3 h-3" style={{ color: T_HEX }} />;
}

// ─── Sortable Header ─────────────────────────────────────────────────────────

function SortTh({
  label, col, sort, order, onSort, align = 'right',
}: {
  label: string; col: SortKey; sort: SortKey; order: SortOrder;
  onSort: (c: SortKey) => void; align?: 'left' | 'right' | 'center';
}) {
  const active = col === sort;
  return (
    <th className="px-4 py-2.5 text-[9px]" style={{ textAlign: align }}>
      <button
        onClick={() => onSort(col)}
        className="flex items-center gap-1 font-bold uppercase tracking-widest transition-colors duration-150"
        style={{
          color: active ? T_HEX : 'rgba(255,255,255,0.25)',
          marginLeft: align === 'right' ? 'auto' : undefined,
        }}
      >
        {align === 'right' && <SortIcon col={col} sort={sort} order={order} />}
        {label}
        {align !== 'right' && <SortIcon col={col} sort={sort} order={order} />}
      </button>
    </th>
  );
}

// ─── Deep Dive Table ──────────────────────────────────────────────────────────

function DeepDiveTable({
  allRows, status, sort, order,
  onStatus, onSort,
}: {
  allRows:  RowData[];
  status:   StatusFilter;
  sort:     SortKey;
  order:    SortOrder;
  onStatus: (s: StatusFilter) => void;
  onSort:   (col: SortKey) => void;
}) {
  const displayed = useMemo(() => {
    const filtered = status === 'all'
      ? allRows
      : allRows.filter(r => status === 'regression' ? r.status === 'regression'
          : status === 'improved' ? r.status === 'improved'
          : r.status === 'stable' || r.status === 'baseline');
    return sortRows(filtered, sort, order);
  }, [allRows, status, sort, order]);

  return (
    <div style={PANEL}>
      {/* Header + filters */}
      <div className="px-6 py-4 space-y-3" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>Deep Dive</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
            {displayed.length} of {allRows.length} runs
          </span>
        </div>
        <FilterBar rows={allRows} status={status} onStatus={onStatus} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${DIVIDER}` }}>
              <SortTh label="Date & Time" col="date"  sort={sort} order={order} onSort={onSort} align="left" />
              <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.25)' }}>Commit</th>
              <SortTh label="Score" col="score" sort={sort} order={order} onSort={onSort} />
              <SortTh label="LCP"   col="lcp"   sort={sort} order={order} onSort={onSort} />
              <SortTh label="TBT"   col="tbt"   sort={sort} order={order} onSort={onSort} />
              <SortTh label="CLS"   col="cls"   sort={sort} order={order} onSort={onSort} />
              <SortTh label="FCP"   col="fcp"   sort={sort} order={order} onSort={onSort} />
              <SortTh label="TTI"   col="tti"   sort={sort} order={order} onSort={onSort} />
              <th className="px-4 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.25)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout" initial={false}>
              {displayed.length === 0 ? (
                <motion.tr key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <td colSpan={9} className="px-6 py-10 text-center text-[12px]"
                    style={{ color: 'rgba(255,255,255,0.25)' }}>
                    No runs match the selected filter.
                  </td>
                </motion.tr>
              ) : (
                displayed.map((row, ri) => {
                  const { entry, prev, status: rowStatus } = row;
                  const rowReg = rowStatus === 'regression';
                  return (
                    <motion.tr
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.18, delay: ri * 0.02 }}
                      style={{
                        borderBottom: `1px solid ${DIVIDER}`,
                        background: rowReg
                          ? 'rgba(239,68,68,0.04)'
                          : ri % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent',
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }} />
                          <span style={{ color: 'rgba(255,255,255,0.52)' }}>{fmtDateFull(entry.timestamp)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <GitCommit className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }} />
                          <span className="font-mono" style={{ color: T_HEX }}>#{entry.shortId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MetricCell curr={entry.scores.performance} prev={prev?.scores.performance ?? null}
                          fmt={v => `${Math.round(v)}`} lowerIsBetter={false} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MetricCell curr={entry.metrics.lcp} prev={prev?.metrics.lcp ?? null} fmt={fmtMs} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MetricCell curr={entry.metrics.tbt} prev={prev?.metrics.tbt ?? null} fmt={fmtMs} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MetricCell curr={entry.metrics.cls} prev={prev?.metrics.cls ?? null} fmt={fmtCls} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MetricCell curr={entry.metrics.fcp} prev={prev?.metrics.fcp ?? null} fmt={fmtMs} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MetricCell curr={entry.metrics.tti} prev={prev?.metrics.tti ?? null} fmt={fmtMs} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={rowStatus} />
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ url }: { url: string }) {
  const hostname = (() => { try { return new URL(url).hostname; } catch { return url; } })();
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.20)' }}>
        <Clock className="w-7 h-7" style={{ color: T_HEX, opacity: 0.7 }} />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>
          No history found for this URL yet
        </p>
        <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Run an analysis on{' '}
          <span className="font-mono" style={{ color: T_HEX }}>{hostname}</span>
          {' '}to start tracking performance over time.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs mt-1">
        <Link to="/">← Back to Analyzer</Link>
      </Button>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function HistoryPage() {
  const [params, setParams] = useSearchParams();

  const url    = params.get('url')    ?? '';
  const status = (params.get('status') ?? 'all') as StatusFilter;
  const sort   = (params.get('sort')   ?? 'date') as SortKey;
  const order  = (params.get('order')  ?? 'desc') as SortOrder;

  const { data: entries = [], isLoading } = useHistory(url || null);

  const allRows = useMemo(() => computeRows(entries), [entries]);

  const hostname = (() => { try { return new URL(url).hostname; } catch { return ''; } })();

  function setParam(key: string, val: string) {
    setParams(p => { const n = new URLSearchParams(p); n.set(key, val); return n; }, { replace: true });
  }

  function handleStatus(s: StatusFilter) { setParam('status', s); }

  function handleSort(col: SortKey) {
    if (col === sort) {
      setParam('order', order === 'asc' ? 'desc' : 'asc');
    } else {
      setParams(p => {
        const n = new URLSearchParams(p);
        n.set('sort', col);
        n.set('order', col === 'score' ? 'desc' : 'asc');
        return n;
      }, { replace: true });
    }
  }

  return (
    <div className="relative min-h-screen bg-background">
      {/* Mesh blobs */}
      <div className="pointer-events-none fixed top-0 left-0 w-[600px] h-[600px]"
        style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(139,92,246,0.11) 0%, transparent 62%)', zIndex: 0 }} />
      <div className="pointer-events-none fixed bottom-0 right-0 w-[600px] h-[600px]"
        style={{ background: 'radial-gradient(ellipse at 100% 100%, rgba(245,158,11,0.08) 0%, transparent 62%)', zIndex: 0 }} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 py-8 space-y-6">

        {/* Breadcrumb + theme toggle */}
        <div className="flex items-center justify-between">
          <Breadcrumb hostname={hostname} />
          <ThemeToggle />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-28">
            <div className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: `${T_HEX}30`, borderTopColor: T_HEX }} />
          </div>
        )}

        {!isLoading && !url && <EmptyState url="https://example.com" />}

        <AnimatePresence>
          {!isLoading && url && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-6"
            >
              {entries.length === 0 ? (
                <EmptyState url={url} />
              ) : (
                <>
                  <PageHeader url={url} entries={entries} />
                  <RegressionHistory entries={entries} />
                  <DeepDiveTable
                    allRows={allRows}
                    status={status}
                    sort={sort}
                    order={order}
                    onStatus={handleStatus}
                    onSort={handleSort}
                  />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
