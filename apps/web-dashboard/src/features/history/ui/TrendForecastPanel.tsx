import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, HelpCircle, Telescope } from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import { getHostname, useWebsites } from '@/entities/website';
import { buildForecastRows, trackedDays, type ForecastRow, type ForecastTone } from '../lib/forecast';

// ─── Styling maps ─────────────────────────────────────────────────────────────

const TONE_CLS: Record<ForecastTone, string> = {
  good:    'text-ld-accent-2',
  bad:     'text-ld-rose',
  neutral: 'text-ld-text-2',
};

const CONFIDENCE_CLS: Record<ForecastRow['forecast']['confidence'], string> = {
  high:   'text-ld-accent-2 border-ld-accent-line',
  medium: 'text-ld-amber border-ld-border-strong',
  low:    'text-ld-text-3 border-ld-border',
};

/** Arrow follows the raw value, not the verdict — a falling LCP still points down. */
function DirectionIcon({ row }: { row: ForecastRow }) {
  const cls = `w-[15px] h-[15px] shrink-0 ${TONE_CLS[row.tone]}`;
  if (row.forecast.confidence === 'low') return <HelpCircle className="w-[15px] h-[15px] shrink-0 text-ld-text-3" />;
  if (row.forecast.direction === 'flat') return <Minus className="w-[15px] h-[15px] shrink-0 text-ld-text-3" />;
  return row.forecast.slopePerDay > 0
    ? <TrendingUp className={cls} />
    : <TrendingDown className={cls} />;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  url:     string;
  entries: HistoryEntry[];
}

/**
 * Projects each tracked metric forward with a least-squares fit over the runs already
 * on screen — no extra request — and, where the site has a target, names the day the
 * line crosses it. Low-confidence fits say so instead of quoting a date.
 *
 * Renders nothing until there are enough usable runs to fit a line.
 */
export function TrendForecastPanel({ url, entries }: Props) {
  const { websites } = useWebsites();

  // Budgets live on the Website document; the backend matches an audit to a site by
  // hostname (see budget.service.ts), so the panel does the same.
  const budgets = useMemo(() => {
    const host = getHostname(url, '');
    if (!host) return null;
    return websites.find(w => getHostname(w.url, '') === host)?.budgets ?? null;
  }, [websites, url]);

  const rows = useMemo(() => buildForecastRows(entries, budgets), [entries, budgets]);
  const days = useMemo(() => trackedDays(entries), [entries]);

  if (rows.length === 0) return null;

  const runs = rows[0]!.forecast.sampleCount;

  return (
    <div className="rounded-[20px] border border-ld-border bg-ld-surface overflow-hidden shadow-ld-shadow-card">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-[12px] px-[24px] pt-[20px] pb-[14px] flex-wrap">
        <h3 className="font-mono text-[12px] tracking-[.10em] uppercase text-ld-text-2 font-semibold flex items-center gap-[8px]">
          <Telescope className="w-[15px] h-[15px] text-ld-accent" />
          Trend Forecast
        </h3>
        <span className="font-mono text-[11px] text-ld-text-3">
          Linear fit over {runs} run{runs === 1 ? '' : 's'}
          {days > 0 && ` · ${days} day${days === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* ── One row per projected metric ────────────────── */}
      <div className="border-t border-ld-border">
        {rows.map(row => (
          <div
            key={row.key}
            className="flex items-center gap-[14px] px-[24px] py-[14px] border-b border-ld-border last:border-b-0 flex-wrap"
          >
            <DirectionIcon row={row} />

            <span className="font-mono text-[11px] tracking-[.10em] uppercase text-ld-text-3 w-[92px] shrink-0">
              {row.label}
            </span>

            <span className="font-mono text-[14px] font-semibold text-ld-text w-[74px] shrink-0">
              {row.current}
            </span>

            <span className={`flex-1 min-w-[220px] text-[13px] ${TONE_CLS[row.tone]}`}>
              {row.sentence}
            </span>

            <span
              className={`font-mono text-[10px] tracking-[.08em] uppercase px-[9px] py-[4px] rounded-full border shrink-0 ${CONFIDENCE_CLS[row.forecast.confidence]}`}
              title={`r² ${row.forecast.r2.toFixed(2)} over ${row.forecast.sampleCount} runs`}
            >
              {row.forecast.confidence} · r² {row.forecast.r2.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <div className="px-[24px] py-[12px] border-t border-ld-border bg-ld-surface-2">
        <span className="font-mono text-[11px] text-ld-text-3">
          Straight-line projection from past runs — it assumes nothing else changes.
          {!budgets && ' Set targets on the site\u2019s page to get crossing dates.'}
        </span>
      </div>
    </div>
  );
}
