import { useMemo } from 'react';
import {
  Filter, BarChart2, Clock, GitCommit, AlertTriangle, CheckCircle2,
  ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink, Loader2, Lightbulb, Minus,
} from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import type { RowData, StatusFilter, SortKey, SortOrder, RowStatus } from '@/features/history/model/types';
import { fmtMs, fmtCls, fmtPct, fmtDateFull, deltaPct, isReg } from '@/features/history/lib/format';
import { sortRows } from '@/features/history/lib/computeRows';

/** "/requests" — the audited path, since the table now spans every route of a site. */
function routeOf(url: string): string {
  try { return new URL(url).pathname || '/'; } catch { return url; }
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Senior Insight ───────────────────────────────────────────────────────────

interface InsightData { label: string; message: string }

const ADVICE: Record<string, string> = {
  lcp: 'likely caused by a new unoptimised image or late-loading hero asset inflating paint time. Compressing media, converting to WebP, or lazy-loading offscreen resources should recover most of the lost score.',
  tbt: 'a newly shipped synchronous script or heavy third-party tag is blocking the main thread. Deferring or chunking that work will restore interactivity and lift the overall score.',
  cls: 'layout shift jumped — a missing width/height on a late-loaded image or an injected ad slot is the typical cause. Reserve space for dynamic content with explicit dimensions or an aspect-ratio rule.',
  fcp: 'a render-blocking stylesheet or font without font-display:swap is delaying initial paint. Inlining critical CSS and preloading key fonts will get content on screen faster.',
  tti: 'heavy JS evaluation is delaying interactivity. Code-splitting the entry bundle and deferring non-critical scripts cuts parse time and makes the page responsive sooner.',
};

function getInsight(rows: RowData[]): InsightData | null {
  const regRow = [...rows].reverse().find(r => r.status === 'regression');
  if (!regRow?.prev) return null;

  const { entry: e, prev: p } = regRow;
  const checks = [
    { key: 'lcp', label: 'LCP spike', delta: deltaPct(e.metrics.lcp, p.metrics.lcp) },
    { key: 'tbt', label: 'TBT spike', delta: deltaPct(e.metrics.tbt, p.metrics.tbt) },
    { key: 'cls', label: 'CLS jump',  delta: deltaPct(e.metrics.cls, p.metrics.cls) },
    { key: 'fcp', label: 'FCP drop',  delta: deltaPct(e.metrics.fcp, p.metrics.fcp) },
    { key: 'tti', label: 'TTI jump',  delta: deltaPct(e.metrics.tti, p.metrics.tti) },
  ].filter(c => c.delta > 10).sort((a, b) => b.delta - a.delta);

  if (!checks.length) return null;

  const { key, label, delta } = checks[0]!;
  return {
    label:   `${label} (+${delta.toFixed(0)}%)`,
    message: ADVICE[key] ?? ADVICE['lcp']!,
  };
}

function SeniorInsight({ rows }: { rows: RowData[] }) {
  const insight = useMemo(() => getInsight(rows), [rows]);
  if (!insight) return null;

  return (
    <div className="flex gap-[12px] px-[18px] py-[16px] rounded-[16px] bg-ld-surface-2 border border-ld-border">
      <span className="text-ld-accent shrink-0 mt-[1px]">
        <Lightbulb className="w-[19px] h-[19px]" />
      </span>
      <div>
        <div className="font-mono text-[10px] tracking-[.12em] uppercase text-ld-accent font-semibold mb-[6px]">
          Senior Insight
        </div>
        <p className="text-[14px] text-ld-text-2 leading-[1.55]">
          The latest regression is primarily driven by a{' '}
          <b className="text-ld-amber font-bold">{insight.label}</b>
          {' '}— {insight.message}
        </p>
      </div>
    </div>
  );
}

// ─── Status filter bar ────────────────────────────────────────────────────────

type FilterOpt = { value: StatusFilter; label: string };

const FILTER_OPTS: FilterOpt[] = [
  { value: 'all',        label: 'All'        },
  { value: 'regression', label: 'Regression' },
  { value: 'improved',   label: 'Improved'   },
  { value: 'stable',     label: 'Stable'     },
];

function FilterBar({
  rows, status, onStatus,
}: {
  rows: RowData[]; status: StatusFilter; onStatus: (s: StatusFilter) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: rows.length, regression: 0, improved: 0, stable: 0 };
    for (const r of rows) {
      if      (r.status === 'regression') c.regression++;
      else if (r.status === 'improved')   c.improved++;
      else                                c.stable++;
    }
    return c;
  }, [rows]);

  return (
    <div className="flex items-center gap-[8px] px-[22px] py-[16px] flex-wrap border-b border-ld-border">
      <span className="inline-flex items-center gap-[6px] font-mono text-[10.5px] tracking-[.10em] uppercase text-ld-text-3 mr-[4px]">
        <Filter className="w-[13px] h-[13px]" />
        Status
      </span>
      {FILTER_OPTS.map(opt => {
        const active = status === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onStatus(opt.value)}
            className={`inline-flex items-center gap-[7px] text-[13px] font-medium px-[13px] py-[7px] rounded-[9px] border transition-all duration-[180ms] ${
              active
                ? 'bg-ld-accent-soft text-ld-accent-2 font-semibold [box-shadow:inset_0_0_0_1px_var(--ld-accent-line)] border-transparent'
                : 'border-transparent text-ld-text-2 bg-transparent hover:bg-ld-surface-2'
            }`}
          >
            {opt.label}
            <span
              className={`font-mono text-[11px] px-[7px] py-[1px] rounded-[6px] ${
                active
                  ? 'bg-ld-accent text-[#04130d]'
                  : 'bg-ld-surface-2 text-ld-text-3'
              }`}
            >
              {counts[opt.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RowStatus }) {
  if (status === 'baseline') {
    return (
      <span className="inline-flex items-center gap-[6px] text-[11.5px] font-semibold px-[11px] py-[5px] rounded-full border border-ld-border-strong text-ld-text-2">
        Baseline
      </span>
    );
  }
  if (status === 'regression') {
    return (
      <span className="inline-flex items-center gap-[6px] text-[11.5px] font-semibold px-[11px] py-[5px] rounded-full border border-[rgba(242,100,122,.3)] bg-[rgba(242,100,122,.08)] text-ld-rose">
        <AlertTriangle className="w-[12px] h-[12px]" /> Regression
      </span>
    );
  }
  if (status === 'improved') {
    return (
      <span className="inline-flex items-center gap-[6px] text-[11.5px] font-semibold px-[11px] py-[5px] rounded-full border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2">
        <CheckCircle2 className="w-[12px] h-[12px]" /> Improved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-[6px] text-[11.5px] font-semibold px-[11px] py-[5px] rounded-full text-ld-text-3">
      <Minus className="w-[12px] h-[12px]" /> Stable
    </span>
  );
}

// ─── Metric cell ──────────────────────────────────────────────────────────────

// "up" = metric got worse (rose delta); "down" = got better (emerald delta)
function MetricCell({
  value, prev, fmt, lowerIsBetter = true, isBad = false,
}: {
  value: number; prev: number | null; fmt: (v: number) => string;
  lowerIsBetter?: boolean; isBad?: boolean;
}) {
  const pct = prev !== null ? deltaPct(value, prev) : null;

  let dir: 'up' | 'down' | null = null;
  if (pct !== null && Math.abs(pct) >= 0.05) {
    dir = lowerIsBetter
      ? (pct > 0 ? 'up' : 'down')   // higher is worse for LCP/TBT/etc.
      : (pct > 0 ? 'down' : 'up');  // higher is better for Score
  }

  const deltaCls = dir === 'up' ? 'text-ld-rose' : dir === 'down' ? 'text-ld-accent-2' : 'text-ld-text-3';

  return (
    <div className="font-mono flex flex-col items-end gap-[2px]">
      <span className={`text-[13.5px] font-semibold ${isBad ? 'text-ld-rose' : 'text-ld-text'}`}>
        {fmt(value)}
      </span>
      {pct !== null ? (
        <span className={`text-[10.5px] ${deltaCls}`}>
          {fmtPct(pct)}
        </span>
      ) : (
        <span className="text-[10.5px] text-ld-text-3">—</span>
      )}
    </div>
  );
}

function ScoreCell({
  value, prev,
}: {
  value: number; prev: number | null;
}) {
  const pct  = prev !== null ? deltaPct(value, prev) : null;
  const isBad = value < 50;
  let dir: 'up' | 'down' | null = null;
  if (pct !== null && Math.abs(pct) >= 0.05) {
    dir = pct > 0 ? 'down' : 'up'; // score increase = good = down(emerald)
  }
  const deltaCls = dir === 'up' ? 'text-ld-rose' : dir === 'down' ? 'text-ld-accent-2' : 'text-ld-text-3';

  return (
    <div className="font-mono flex flex-col items-end gap-[2px]">
      <span className={`text-[16px] font-bold ${isBad ? 'text-ld-rose' : 'text-ld-text'}`}>
        {Math.round(value)}
      </span>
      {pct !== null ? (
        <span className={`text-[10.5px] ${deltaCls}`}>{fmtPct(pct)}</span>
      ) : (
        <span className="text-[10.5px] text-ld-text-3">—</span>
      )}
    </div>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortTh({
  label, col, sort, order, onSort, align = 'right',
}: {
  label: string; col: SortKey; sort: SortKey; order: SortOrder;
  onSort: (c: SortKey) => void; align?: 'left' | 'right';
}) {
  const active = col === sort;
  const Icon = active
    ? order === 'asc' ? ChevronUp : ChevronDown
    : ChevronsUpDown;

  return (
    <th
      className={`px-[14px] py-[12px] font-mono text-[10px] tracking-[.10em] uppercase text-ld-text-3 font-semibold whitespace-nowrap border-t border-b border-ld-border ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-[4px] transition-colors duration-150 ${
          active ? 'text-ld-accent' : 'text-ld-text-3 hover:text-ld-text-2'
        } ${align === 'right' ? 'ml-auto' : ''}`}
      >
        {align === 'right' && <Icon className="w-[12px] h-[12px]" />}
        {label}
        {align === 'left'  && <Icon className="w-[12px] h-[12px]" />}
      </button>
    </th>
  );
}

// ─── Bad-value thresholds ─────────────────────────────────────────────────────

const BAD: Record<string, (v: number) => boolean> = {
  lcp: v => v > 4000,
  tbt: v => v > 600,
  cls: v => v > 0.25,
  fcp: v => v > 3000,
  tti: v => v > 7300,
};

// ─── Main component ───────────────────────────────────────────────────────────

export function HistoryDeepDiveTable({
  allRows, status, sort, order, onStatus, onSort, onOpen, loadingId,
}: Props) {
  const displayed = useMemo(() => {
    const filtered = status === 'all'
      ? allRows
      : allRows.filter(r =>
          status === 'regression' ? r.status === 'regression'
          : status === 'improved' ? r.status === 'improved'
          : r.status === 'stable' || r.status === 'baseline'
        );
    return sortRows(filtered, sort, order);
  }, [allRows, status, sort, order]);

  // Newest first for display; allRows is chronological for insight
  const reversedRows = useMemo(() => [...allRows].reverse(), [allRows]);

  return (
    <div className="flex flex-col gap-[16px]">

      {/* Senior Insight */}
      <SeniorInsight rows={reversedRows} />

      {/* Deep Dive card */}
      <div className="rounded-[18px] border border-ld-border bg-ld-surface overflow-hidden shadow-ld-shadow-card">

        {/* Card head */}
        <div className="flex items-center gap-[11px] px-[22px] pt-[20px] pb-0">
          <span className="w-[30px] h-[30px] rounded-[8px] grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent shrink-0">
            <BarChart2 className="w-[15px] h-[15px]" />
          </span>
          <h3 className="text-[16px] font-bold text-ld-text">Deep Dive</h3>
          <span className="font-mono text-[12px] text-ld-text-3">
            {displayed.length} of {allRows.length} runs
          </span>
        </div>

        {/* Filter bar */}
        <FilterBar rows={allRows} status={status} onStatus={onStatus} />

        {/* Scrollable table */}
        <div className="overflow-x-auto">
          <table className="w-full [border-collapse:collapse] min-w-[860px]">
            <thead>
              <tr>
                <SortTh label="Date & Time" col="date"  sort={sort} order={order} onSort={onSort} align="left" />
                <th className="px-[14px] py-[12px] text-left font-mono text-[10px] tracking-[.10em] uppercase text-ld-text-3 font-semibold border-t border-b border-ld-border whitespace-nowrap">
                  Route
                </th>
                <th className="px-[14px] py-[12px] text-left font-mono text-[10px] tracking-[.10em] uppercase text-ld-text-3 font-semibold border-t border-b border-ld-border whitespace-nowrap">
                  Commit
                </th>
                <SortTh label="Score" col="score" sort={sort} order={order} onSort={onSort} />
                <SortTh label="LCP"   col="lcp"   sort={sort} order={order} onSort={onSort} />
                <SortTh label="TBT"   col="tbt"   sort={sort} order={order} onSort={onSort} />
                <SortTh label="CLS"   col="cls"   sort={sort} order={order} onSort={onSort} />
                <SortTh label="FCP"   col="fcp"   sort={sort} order={order} onSort={onSort} />
                <SortTh label="TTI"   col="tti"   sort={sort} order={order} onSort={onSort} />
                <th className="px-[14px] py-[12px] text-center font-mono text-[10px] tracking-[.10em] uppercase text-ld-text-3 font-semibold border-t border-b border-ld-border whitespace-nowrap">
                  Status
                </th>
                <th className="px-[14px] py-[12px] border-t border-b border-ld-border" />
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-[22px] py-[40px] text-center text-[13px] text-ld-text-3">
                    No runs match the selected filter.
                  </td>
                </tr>
              ) : (
                displayed.map(row => {
                  const { entry, prev, status: rowStatus } = row;
                  const isRegRow = rowStatus === 'regression';
                  const m = entry.metrics;
                  const pm = prev?.metrics ?? null;

                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-ld-border transition-[background] duration-[150ms] ${
                        isRegRow
                          ? 'bg-[rgba(242,100,122,.05)] hover:bg-[rgba(242,100,122,.09)]'
                          : 'hover:bg-ld-surface-2'
                      }`}
                    >
                      {/* Date */}
                      <td className="px-[14px] py-[13px] text-left">
                        <span className="flex items-center gap-[9px]">
                          <Clock className="w-[14px] h-[14px] text-ld-text-3 shrink-0" />
                          <b className="font-mono text-[13px] font-medium text-ld-text whitespace-nowrap">
                            {fmtDateFull(entry.timestamp)}
                          </b>
                        </span>
                      </td>

                      {/* Route — the list spans every route of the site, so name it */}
                      <td className="px-[14px] py-[13px] text-left">
                        <span className="font-mono text-[12.5px] text-ld-text-2 truncate max-w-[220px] inline-block align-middle" title={entry.url}>
                          {routeOf(entry.url)}
                        </span>
                      </td>

                      {/* Commit */}
                      <td className="px-[14px] py-[13px] text-left">
                        <span className="inline-flex items-center gap-[7px] font-mono text-[12.5px] text-ld-text-2">
                          <GitCommit className="w-[13px] h-[13px] text-ld-text-3" />
                          #{entry.shortId}
                        </span>
                      </td>

                      {/* Score */}
                      <td className="px-[14px] py-[13px] text-right">
                        <ScoreCell value={entry.scores.performance} prev={prev?.scores.performance ?? null} />
                      </td>

                      {/* LCP */}
                      <td className="px-[14px] py-[13px] text-right">
                        <MetricCell value={m.lcp} prev={pm?.lcp ?? null} fmt={fmtMs} isBad={BAD['lcp']!(m.lcp)} />
                      </td>

                      {/* TBT */}
                      <td className="px-[14px] py-[13px] text-right">
                        <MetricCell value={m.tbt} prev={pm?.tbt ?? null} fmt={fmtMs} isBad={BAD['tbt']!(m.tbt)} />
                      </td>

                      {/* CLS */}
                      <td className="px-[14px] py-[13px] text-right">
                        <MetricCell value={m.cls} prev={pm?.cls ?? null} fmt={fmtCls} isBad={BAD['cls']!(m.cls)} />
                      </td>

                      {/* FCP */}
                      <td className="px-[14px] py-[13px] text-right">
                        <MetricCell value={m.fcp} prev={pm?.fcp ?? null} fmt={fmtMs} isBad={BAD['fcp']!(m.fcp)} />
                      </td>

                      {/* TTI */}
                      <td className="px-[14px] py-[13px] text-right">
                        <MetricCell value={m.tti} prev={pm?.tti ?? null} fmt={fmtMs} isBad={BAD['tti']!(m.tti)} />
                      </td>

                      {/* Status */}
                      <td className="px-[14px] py-[13px] text-center">
                        <StatusBadge status={rowStatus} />
                      </td>

                      {/* Open */}
                      <td className="px-[14px] py-[13px] text-right">
                        <button
                          onClick={() => onOpen(entry)}
                          disabled={loadingId === entry.id}
                          className="inline-flex items-center gap-[6px] text-[12.5px] font-semibold text-ld-text-2 px-[13px] py-[7px] rounded-[9px] border border-ld-border-strong bg-ld-surface transition-[color,border-color,background] duration-[180ms] disabled:opacity-50 hover:text-ld-accent hover:border-ld-accent-line hover:bg-ld-accent-soft"
                        >
                          {loadingId === entry.id
                            ? <Loader2 className="w-[13px] h-[13px] animate-spin" />
                            : <ExternalLink className="w-[13px] h-[13px]" />}
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
