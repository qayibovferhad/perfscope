import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter, Activity, Clock, GitCommit, AlertTriangle, CheckCircle2,
  ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink, Loader2,
} from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import type { RowData, StatusFilter, SortKey, SortOrder, RowStatus } from '@/features/history/model/types';
import { fmtMs, fmtCls, fmtPct, fmtDateFull, deltaPct, isReg } from '@/features/history/lib/format';
import { sortRows } from '@/features/history/lib/computeRows';

interface Props {
  allRows:   RowData[];
  status:    StatusFilter;
  sort:      SortKey;
  order:     SortOrder;
  onStatus:  (s: StatusFilter) => void;
  onSort:    (col: SortKey) => void;
  onOpen:    (entry: HistoryEntry) => void;
  loadingId: string | null;
}

// ─── Internal sub-components ─────────────────────────────────────────────────

const STATUS_OPTS: { value: StatusFilter; label: string; cls?: string; chip?: string }[] = [
  { value: 'all',        label: 'All' },
  { value: 'regression', label: 'Regression', cls: 'bg-ps-reg-muted     border-ps-reg-border     text-ps-regression  shadow-glow-reg',   chip: 'bg-ps-reg-muted     text-ps-regression'  },
  { value: 'improved',   label: 'Improved',   cls: 'bg-ps-healthy-muted border-ps-healthy-border text-ps-healthy    shadow-glow-ok',    chip: 'bg-ps-healthy-muted text-ps-healthy'    },
  { value: 'stable',     label: 'Stable' },
];

function FilterBar({ rows, status, onStatus }: {
  rows: RowData[]; status: StatusFilter; onStatus: (s: StatusFilter) => void;
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
        <Filter className="w-3 h-3 text-ps-muted" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-ps-muted">Status</span>
      </div>
      {STATUS_OPTS.map(opt => {
        const active = status === opt.value;
        const activeCls = opt.cls ?? 'bg-ps-accent-hover border-ps-accent-border text-ps-accent shadow-glow-accent';
        const chipCls   = opt.chip ?? (active ? 'bg-ps-accent-hover text-ps-accent' : 'bg-white/[0.06] text-ps-faint');
        return (
          <button
            key={opt.value}
            onClick={() => onStatus(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 border ${
              active ? activeCls : 'bg-white/[0.04] border-white/[0.08] text-ps-secondary'
            }`}
          >
            {opt.label}
            <span className={`text-[9px] px-1.5 py-0 rounded-full tabular-nums ${active ? chipCls : 'bg-white/[0.06] text-ps-faint'}`}>
              {counts[opt.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  if (status === 'baseline') return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/[0.05] text-ps-faint">Baseline</span>;
  if (status === 'regression') return (
    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-ps-reg-muted border border-ps-reg-border text-ps-regression">
      <AlertTriangle className="w-2.5 h-2.5" /> Regression
    </span>
  );
  if (status === 'improved') return (
    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-ps-healthy-muted border border-ps-healthy-border text-ps-healthy">
      <CheckCircle2 className="w-2.5 h-2.5" /> Improved
    </span>
  );
  return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/[0.04] text-ps-faint">Stable</span>;
}

function MetricCell({ curr, prev, fmt, lowerIsBetter = true }: {
  curr: number; prev: number | null; fmt: (v: number) => string; lowerIsBetter?: boolean;
}) {
  const reg = prev !== null && (lowerIsBetter ? isReg(curr, prev) : isReg(prev, curr));
  const pct = prev !== null ? deltaPct(curr, prev) : null;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`text-[12px] font-bold tabular-nums ${reg ? 'text-ps-regression' : 'text-ps-body'}`}
        style={reg ? { textShadow: '0 0 8px var(--ps-reg-glow)' } : undefined}
      >
        {fmt(curr)}
      </span>
      {pct !== null && (
        <span className={`text-[9px] tabular-nums ${reg ? 'text-ps-regression' : pct < -3 ? 'text-ps-healthy' : 'text-ps-faint'}`}>
          {fmtPct(pct)}
        </span>
      )}
    </div>
  );
}

function SortIcon({ col, sort, order }: { col: SortKey; sort: SortKey; order: SortOrder }) {
  if (col !== sort) return <ChevronsUpDown className="w-3 h-3 opacity-25" />;
  return order === 'asc'
    ? <ChevronUp   className="w-3 h-3 text-ps-accent" />
    : <ChevronDown className="w-3 h-3 text-ps-accent" />;
}

function SortTh({ label, col, sort, order, onSort, align = 'right' }: {
  label: string; col: SortKey; sort: SortKey; order: SortOrder;
  onSort: (c: SortKey) => void; align?: 'left' | 'right' | 'center';
}) {
  const active = col === sort;
  return (
    <th className="px-4 py-2.5 text-[9px]" style={{ textAlign: align }}>
      <button
        onClick={() => onSort(col)}
        className={`flex items-center gap-1 font-bold uppercase tracking-widest transition-colors duration-150 ${
          active ? 'text-ps-accent' : 'text-ps-faint'
        }`}
        style={{ marginLeft: align === 'right' ? 'auto' : undefined }}
      >
        {align === 'right' && <SortIcon col={col} sort={sort} order={order} />}
        {label}
        {align !== 'right' && <SortIcon col={col} sort={sort} order={order} />}
      </button>
    </th>
  );
}

// ─── Main widget ─────────────────────────────────────────────────────────────

export function HistoryDeepDiveTable({
  allRows, status, sort, order, onStatus, onSort, onOpen, loadingId,
}: Props) {
  const displayed = useMemo(() => {
    const filtered = status === 'all'
      ? allRows
      : allRows.filter(r =>
          status === 'regression' ? r.status === 'regression'
          : status === 'improved' ? r.status === 'improved'
          : r.status === 'stable' || r.status === 'baseline');
    return sortRows(filtered, sort, order);
  }, [allRows, status, sort, order]);

  return (
    <div className="rounded-2xl overflow-hidden bg-ps-surface border border-ps-surface-border backdrop-blur-md">
      {/* Header + filters */}
      <div className="px-6 py-4 space-y-3 border-b border-ps-divider">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-ps-accent" />
          <span className="text-sm font-semibold text-ps-body">Deep Dive</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-ps-muted">
            {displayed.length} of {allRows.length} runs
          </span>
        </div>
        <FilterBar rows={allRows} status={status} onStatus={onStatus} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="border-b border-ps-divider">
              <SortTh label="Date & Time" col="date"  sort={sort} order={order} onSort={onSort} align="left" />
              <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-ps-faint">Commit</th>
              <SortTh label="Score" col="score" sort={sort} order={order} onSort={onSort} />
              <SortTh label="LCP"   col="lcp"   sort={sort} order={order} onSort={onSort} />
              <SortTh label="TBT"   col="tbt"   sort={sort} order={order} onSort={onSort} />
              <SortTh label="CLS"   col="cls"   sort={sort} order={order} onSort={onSort} />
              <SortTh label="FCP"   col="fcp"   sort={sort} order={order} onSort={onSort} />
              <SortTh label="TTI"   col="tti"   sort={sort} order={order} onSort={onSort} />
              <th className="px-4 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest text-ps-faint">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout" initial={false}>
              {displayed.length === 0 ? (
                <motion.tr key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <td colSpan={9} className="px-6 py-10 text-center text-[12px] text-ps-faint">
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
                      className={`border-b border-ps-divider ${rowReg ? 'bg-ps-reg-muted' : ri % 2 === 0 ? 'bg-white/[0.012]' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 shrink-0 text-ps-faint" />
                          <span className="text-ps-secondary">{fmtDateFull(entry.timestamp)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <GitCommit className="w-3 h-3 shrink-0 text-ps-faint" />
                          <span className="font-mono text-ps-accent">#{entry.shortId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right"><MetricCell curr={entry.scores.performance} prev={prev?.scores.performance ?? null} fmt={v => `${Math.round(v)}`} lowerIsBetter={false} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell curr={entry.metrics.lcp} prev={prev?.metrics.lcp ?? null} fmt={fmtMs} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell curr={entry.metrics.tbt} prev={prev?.metrics.tbt ?? null} fmt={fmtMs} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell curr={entry.metrics.cls} prev={prev?.metrics.cls ?? null} fmt={fmtCls} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell curr={entry.metrics.fcp} prev={prev?.metrics.fcp ?? null} fmt={fmtMs} /></td>
                      <td className="px-4 py-3 text-right"><MetricCell curr={entry.metrics.tti} prev={prev?.metrics.tti ?? null} fmt={fmtMs} /></td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={rowStatus} /></td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => onOpen(entry)}
                          disabled={loadingId === entry.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all duration-150 disabled:opacity-50 bg-ps-accent-muted border border-ps-accent-border text-ps-accent"
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
