import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, TrendingUp, TrendingDown, Minus,
  Download, FileText, Clock, GitCommit, AlertTriangle,
  CheckCircle2, Activity, ChevronUp, ChevronDown, ChevronsUpDown,
  Filter, ArrowRight, GitCompareArrows, ExternalLink, Loader2,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from '@/shared/ui/theme/ThemeToggle';
import { useHistory, useAllHistory, fetchHistoryResult, type HistoryEntry } from '@/features/history/hooks/useHistory';
import { useWebsites } from '@/features/dashboard/useWebsites';
import { RegressionHistory, EvolutionChart } from '@/features/history/components/RegressionHistory';
import { CompareHistoryPage } from '@/pages/compare-history/CompareHistoryPage';
import { useAnalysisStore } from '@/store/analysisStore';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  background:           'var(--ps-panel-bg)',
  backdropFilter:       'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border:               '1px solid var(--ps-panel-border)',
  borderRadius:         '1rem',
  overflow:             'hidden',
};
const DIVIDER  = 'var(--ps-divider)';
const T_HEX    = 'var(--ps-accent)';
const T_GLOW   = 'var(--ps-accent-glow-lg)';
const REG_CLR  = 'var(--ps-regression)';
const REG_GLOW = 'var(--ps-reg-glow)';
const OK_CLR   = 'var(--ps-healthy)';
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
        to="/app"
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
          style={{ filter: 'drop-shadow(0 0 4px var(--ps-accent-glow))' }} />
        <circle cx={xOf(scores.length - 1)} cy={yOf(last)} r="3.5"
          fill={T_HEX} stroke="rgba(17,24,39,0.9)" strokeWidth="1.5"
          style={{ filter: 'drop-shadow(0 0 6px var(--ps-accent-glow-lg))' }} />
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
            style={{ background: 'var(--ps-accent-muted)', border: '1px solid var(--ps-accent-border)' }}>
            <Globe className="w-5 h-5" style={{ color: T_HEX }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold" style={{ color: '#e2e8f0' }}>{hostname}</h1>
              {regCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--ps-reg-muted)', border: '1px solid var(--ps-reg-border)', color: REG_CLR }}>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ps-btn-ghost">
              <Download className="w-3 h-3" /> Export JSON
            </button>
            <button onClick={() => exportCsv(entries, url)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ps-badge-amber">
              <FileText className="w-3 h-3" /> Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const STATUS_OPTS: { value: StatusFilter; label: string; color?: string; border?: string; bg?: string; chipBg?: string; glow?: string }[] = [
  { value: 'all',        label: 'All'        },
  { value: 'regression', label: 'Regression', color: REG_CLR, border: 'var(--ps-reg-border)',     bg: 'var(--ps-reg-muted)',     chipBg: 'var(--ps-reg-muted)',     glow: 'var(--ps-reg-glow)'     },
  { value: 'improved',   label: 'Improved',   color: OK_CLR,  border: 'var(--ps-healthy-border)', bg: 'var(--ps-healthy-muted)', chipBg: 'var(--ps-healthy-muted)', glow: 'var(--ps-healthy-glow)' },
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
                ? (opt.bg ?? 'var(--ps-accent-hover)')
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active
                ? (opt.border ?? 'var(--ps-accent-border)')
                : 'rgba(255,255,255,0.08)'}`,
              color: active
                ? (opt.color ?? T_HEX)
                : 'rgba(255,255,255,0.40)',
              boxShadow: active && opt.glow
                ? `0 0 12px ${opt.glow}`
                : active
                ? '0 0 12px var(--ps-accent-glow-sm)'
                : 'none',
            }}
          >
            {opt.label}
            <span
              className="text-[9px] px-1.5 py-0 rounded-full tabular-nums"
              style={{
                background: active ? (opt.chipBg ?? 'var(--ps-accent-hover)') : 'rgba(255,255,255,0.06)',
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
      style={{ background: 'var(--ps-reg-muted)', border: '1px solid var(--ps-reg-border)', color: REG_CLR }}>
      <AlertTriangle className="w-2.5 h-2.5" /> Regression
    </span>
  );
  if (status === 'improved') return (
    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'var(--ps-healthy-muted)', border: '1px solid var(--ps-healthy-border)', color: OK_CLR }}>
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
  onStatus, onSort, onOpen, loadingId,
}: {
  allRows:   RowData[];
  status:    StatusFilter;
  sort:      SortKey;
  order:     SortOrder;
  onStatus:  (s: StatusFilter) => void;
  onSort:    (col: SortKey) => void;
  onOpen:    (entry: HistoryEntry) => void;
  loadingId: string | null;
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
              <th className="px-4 py-2.5" />
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
                          ? 'var(--ps-reg-muted)'
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
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => onOpen(entry)}
                          disabled={loadingId === entry.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all duration-150 disabled:opacity-50"
                          style={{
                            background:  'var(--ps-accent-muted)',
                            border:      '1px solid var(--ps-accent-border)',
                            color:       'var(--ps-accent)',
                          }}
                          title="Open full result in Analyzer"
                        >
                          {loadingId === entry.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <ExternalLink className="w-3 h-3" />}
                          Open
                        </button>
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
        style={{ background: 'var(--ps-accent-muted)', border: '1px solid var(--ps-accent-border)' }}>
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
        <Link to="/app">← Back to Analyzer</Link>
      </Button>
    </motion.div>
  );
}

// ─── Website History Card (overview) ─────────────────────────────────────────

function WebsiteHistoryCard({ siteUrl, siteName, entries }: {
  siteUrl:  string;
  siteName: string;
  entries:  HistoryEntry[];
}) {
  const navigate     = useNavigate();
  const [hov, setHov] = useState<number | null>(null);
  const hostname     = (() => { try { return new URL(siteUrl).hostname; } catch { return siteUrl; } })();
  const latest       = entries[entries.length - 1];
  const prev         = entries.length >= 2 ? entries[entries.length - 2] : null;
  const trend        = prev ? latest.scores.performance - prev.scores.performance : 0;

  const regCount = useMemo(() => {
    let n = 0;
    for (let i = 1; i < entries.length; i++) {
      const dp = (entries[i].metrics.lcp - entries[i-1].metrics.lcp) / (entries[i-1].metrics.lcp || 1) * 100;
      const dt = (entries[i].metrics.tbt - entries[i-1].metrics.tbt) / (entries[i-1].metrics.tbt || 1) * 100;
      if (dp > 15 || dt > 15) n++;
    }
    return n;
  }, [entries]);

  const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)', backdropFilter: 'blur(12px)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--ps-accent-muted)' }}>
            <Globe className="w-4 h-4" style={{ color: T_HEX }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--ps-text-heading)' }}>
              {siteName || hostname}
            </p>
            <p className="text-[10px] font-mono truncate" style={{ color: 'rgba(255,255,255,0.28)' }}>{hostname}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* score badge */}
          <div className="flex flex-col items-end">
            <span className="text-[22px] font-black tabular-nums leading-none" style={{ color: 'var(--ps-text-heading)' }}>
              {Math.round(latest.scores.performance)}
            </span>
            <span className="text-[10px] flex items-center gap-0.5"
              style={{ color: trend > 0 ? 'var(--ps-healthy)' : trend < 0 ? 'var(--ps-regression)' : 'rgba(255,255,255,0.30)' }}>
              {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {trend !== 0 ? `${trend > 0 ? '+' : ''}${Math.round(trend)} pts` : 'stable'}
            </span>
          </div>

          {regCount > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--ps-reg-muted)', border: '1px solid var(--ps-reg-border)', color: 'var(--ps-regression)' }}>
              <AlertTriangle className="w-2.5 h-2.5" /> {regCount} regression{regCount > 1 ? 's' : ''}
            </span>
          )}

          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>
            {entries.length} run{entries.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Key metrics row ── */}
      <div className="grid grid-cols-4 divide-x px-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.08)' }}>
        {[
          { label: 'LCP',   value: fmtMs(latest.metrics.lcp) },
          { label: 'TBT',   value: fmtMs(latest.metrics.tbt) },
          { label: 'CLS',   value: latest.metrics.cls.toFixed(3) },
          { label: 'FCP',   value: fmtMs(latest.metrics.fcp) },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center py-3"
            style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--ps-text-heading)' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Evolution chart ── */}
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-center gap-4 mb-3">
          {[
            { color: '#8B5CF6', label: 'LCP', glow: 'rgba(139,92,246,0.6)' },
            { color: '#F59E0B', label: 'TBT', glow: 'rgba(245,158,11,0.6)' },
            { color: '#ef4444', label: 'Regression', dot: true, glow: 'rgba(239,68,68,0.75)' },
          ].map(({ color, label, dot, glow }) => (
            <span key={label} className="flex items-center gap-1.5 text-[9px]"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              {dot
                ? <span className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: color, boxShadow: `0 0 6px ${glow}` }} />
                : <span className="w-4 h-0.5 rounded-full inline-block" style={{ background: color, boxShadow: `0 0 4px ${glow}` }} />
              }
              {label}
            </span>
          ))}
        </div>
        <EvolutionChart entries={entries} hoveredIdx={hov} onHover={setHov} />
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-6 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Last run: {new Date(latest.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        <button
          onClick={() => navigate(`/history?url=${encodeURIComponent(siteUrl)}`)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'var(--ps-accent-muted)', color: T_HEX, border: '1px solid var(--ps-accent-border)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-accent-hover)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ps-accent-muted)'; }}
        >
          View Details <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── All Websites Overview ────────────────────────────────────────────────────

function WebsitesOverview({ allEntries, isLoading }: { allEntries: HistoryEntry[]; isLoading: boolean }) {
  const { websites } = useWebsites();

  const grouped = useMemo(() => {
    const map: Record<string, HistoryEntry[]> = {};
    for (const e of allEntries) {
      if (!map[e.url]) map[e.url] = [];
      map[e.url].push(e);
    }
    // sort each group oldest→newest for sparkline direction
    for (const url of Object.keys(map)) {
      map[url].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    return map;
  }, [allEntries]);

  const sitesWithHistory = useMemo(() =>
    websites.filter(s => grouped[s.url]?.length > 0)
      .sort((a, b) => {
        const la = grouped[a.url]?.at(-1)?.timestamp ?? '';
        const lb = grouped[b.url]?.at(-1)?.timestamp ?? '';
        return lb.localeCompare(la);
      }),
  [websites, grouped]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-28">
        <div className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: `${T_HEX}30`, borderTopColor: T_HEX }} />
      </div>
    );
  }

  if (sitesWithHistory.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--ps-accent-muted)', border: '1px solid var(--ps-accent-border)' }}>
          <Clock className="w-7 h-7" style={{ color: T_HEX, opacity: 0.7 }} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>No history yet</p>
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Run an analysis to start tracking performance over time.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs mt-1">
          <Link to="/app">Go to Analyzer</Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sitesWithHistory.map((site, i) => (
        <motion.div key={site._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}>
          <WebsiteHistoryCard
            siteUrl={site.url}
            siteName={site.name}
            entries={grouped[site.url]}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

type Tab = 'analysis' | 'compare';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'analysis', label: 'Analysis', icon: <Activity         className="w-3.5 h-3.5" /> },
    { key: 'compare',  label: 'Compare',  icon: <GitCompareArrows className="w-3.5 h-3.5" /> },
  ];
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--ps-panel-border)' }}>
      {tabs.map(({ key, label, icon }) => {
        const isActive = active === key;
        return (
          <button key={key} onClick={() => onChange(key)}
            className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
            style={{ color: isActive ? 'var(--ps-text-heading)' : 'var(--ps-text-muted)' }}
          >
            {isActive && (
              <motion.div layoutId="history-tab-pill"
                className="absolute inset-0 rounded-lg"
                style={{ background: 'var(--ps-accent-hover)', border: '1px solid var(--ps-accent-border)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2"
              style={{ color: isActive ? T_HEX : 'inherit' }}>
              {icon}{label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function HistoryPage() {
  const [params, setParams] = useSearchParams();

  const tab    = (params.get('tab') ?? 'analysis') as Tab;
  const url    = params.get('url')    ?? '';
  const status = (params.get('status') ?? 'all') as StatusFilter;
  const sort   = (params.get('sort')   ?? 'date') as SortKey;
  const order  = (params.get('order')  ?? 'desc') as SortOrder;

  const { data: urlEntries = [], isLoading: urlLoading } = useHistory(url || null);
  const { data: allEntries = [], isLoading: allLoading  } = useAllHistory();

  const allRows  = useMemo(() => computeRows(urlEntries), [urlEntries]);
  const hostname = (() => { try { return new URL(url).hostname; } catch { return ''; } })();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const setResult = useAnalysisStore(s => s.setResult);

  // Extension deep-link: /history?open=<analysisId>
  useEffect(() => {
    const openId = params.get('open');
    if (!openId) return;
    fetchHistoryResult(openId)
      .then(result => {
        setResult(result, result.url as string);
        navigate('/app');
      })
      .catch(() => undefined);
  }, []);

  async function handleOpenInAnalyzer(entry: HistoryEntry) {
    setLoadingId(entry.id);
    try {
      const result = await fetchHistoryResult(entry.id);
      setResult(result, entry.url);
      navigate('/app');
    } catch {
      // result not stored yet — fall through silently
    } finally {
      setLoadingId(null);
    }
  }

  function setTab(t: Tab) {
    setParams(_ => {
      const n = new URLSearchParams();
      if (t !== 'analysis') n.set('tab', t);
      return n;
    }, { replace: true });
  }

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
        n.set('sort', col); n.set('order', col === 'score' ? 'desc' : 'asc');
        return n;
      }, { replace: true });
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {tab === 'analysis'
          ? <Breadcrumb hostname={hostname} />
          : <nav className="flex items-center gap-1.5 text-sm select-none">
              <span className="font-semibold" style={{ color: '#e2e8f0' }}>History</span>
              <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 16 }}>›</span>
              <div className="flex items-center gap-1.5">
                <GitCompareArrows className="w-3.5 h-3.5" style={{ color: T_HEX }} />
                <span className="font-semibold" style={{ color: '#e2e8f0' }}>Compare</span>
              </div>
            </nav>
        }
        <ThemeToggle />
      </div>

      {/* Tab Bar */}
      <TabBar active={tab} onChange={setTab} />

      {/* Content */}
      <AnimatePresence mode="wait">

        {tab === 'analysis' && (
          <motion.div key="analysis"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {!url ? (
              <WebsitesOverview allEntries={allEntries} isLoading={allLoading} />
            ) : (
              <>
                {urlLoading && (
                  <div className="flex items-center justify-center py-28">
                    <div className="w-6 h-6 rounded-full border-2 animate-spin"
                      style={{ borderColor: `${T_HEX}30`, borderTopColor: T_HEX }} />
                  </div>
                )}
                {!urlLoading && (
                  urlEntries.length === 0 ? <EmptyState url={url} /> : (
                    <>
                      <PageHeader url={url} entries={urlEntries} />
                      <RegressionHistory entries={urlEntries} />
                      <DeepDiveTable
                        allRows={allRows} status={status} sort={sort} order={order}
                        onStatus={handleStatus} onSort={handleSort}
                        onOpen={handleOpenInAnalyzer} loadingId={loadingId}
                      />
                    </>
                  )
                )}
              </>
            )}
          </motion.div>
        )}

        {tab === 'compare' && (
          <motion.div key="compare"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
          >
            <CompareHistoryPage asTab />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
