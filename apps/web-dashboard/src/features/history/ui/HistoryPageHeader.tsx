import { useMemo } from 'react';
import { Globe, AlertTriangle, Download, FileText } from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import { isReg } from '@/features/history/lib/format';
import { exportJson, exportCsv } from '@/features/history/lib/export';
import { ScoreSparkline } from './ScoreSparkline';
import { getHostname } from '@/entities/website';

// ─── CWV band helpers ─────────────────────────────────────────────────────────

type Band = 'g' | 'w' | 'p';

const BAND_CLS: Record<Band, string> = {
  g: 'text-ld-accent-2',
  w: 'text-ld-amber',
  p: 'text-ld-rose',
};

function lcpBand(ms: number): Band { return ms <= 2500 ? 'g' : ms <= 4000 ? 'w' : 'p'; }
function tbtBand(ms: number): Band { return ms <= 200  ? 'g' : ms <= 600  ? 'w' : 'p'; }
function clsBand(v:  number): Band { return v  <= 0.1  ? 'g' : v  <= 0.25 ? 'w' : 'p'; }
function fcpBand(ms: number): Band { return ms <= 1800 ? 'g' : ms <= 3000 ? 'w' : 'p'; }

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

// right border: all except last; on mobile (2-col) also hide from index 1
function borderR(i: number) {
  if (i === 3) return '';
  if (i === 1) return 'border-r border-ld-border max-[760px]:border-r-0';
  return 'border-r border-ld-border';
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props { url: string; entries: HistoryEntry[] }

export function HistoryPageHeader({ url, entries }: Props) {
  const hostname = getHostname(url);
  const latest   = entries.at(-1)!;
  const m        = latest.metrics;

  const regCount = useMemo(() => {
    let n = 0;
    for (let i = 1; i < entries.length; i++) {
      if (isReg(entries[i]!.metrics.lcp, entries[i - 1]!.metrics.lcp) ||
          isReg(entries[i]!.metrics.tbt, entries[i - 1]!.metrics.tbt)) n++;
    }
    return n;
  }, [entries]);

  const metrics = [
    { label: 'LCP', value: fmtMs(m.lcp),     band: lcpBand(m.lcp) },
    { label: 'TBT', value: fmtMs(m.tbt),     band: tbtBand(m.tbt) },
    { label: 'CLS', value: m.cls.toFixed(3), band: clsBand(m.cls) },
    { label: 'FCP', value: fmtMs(m.fcp),     band: fcpBand(m.fcp) },
  ] as const;

  return (
    <>
      {/* ── Top row: favicon · site info · score · exports ─────────── */}
      <div className="flex items-center gap-[14px] px-[24px] pt-[22px] flex-wrap">

        <span className="w-[42px] h-[42px] rounded-[12px] shrink-0 grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent">
          <Globe className="w-[20px] h-[20px]" />
        </span>

        <div className="flex-1 min-w-0">
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ld-text leading-none flex items-center gap-[10px] flex-wrap">
            {hostname}
            {regCount > 0 && (
              <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold text-ld-rose px-[11px] py-[5px] rounded-full border border-[rgba(242,100,122,0.3)] bg-[rgba(242,100,122,0.08)]">
                <AlertTriangle className="w-[13px] h-[13px]" />
                {regCount} regression{regCount > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <span className="block font-mono text-[12.5px] text-ld-text-3 mt-[3px] truncate">
            {url} · {entries.length} runs tracked · max 10
          </span>
        </div>

        <div className="flex items-center gap-[12px] flex-wrap shrink-0">
          <div>
            <p className="font-mono text-[9.5px] tracking-[.12em] uppercase text-ld-text-3 mb-[10px]">
              Performance score
            </p>
            <ScoreSparkline entries={entries} />
          </div>
          <div className="flex flex-col gap-[8px]">
            <button
              onClick={() => exportJson(entries, url)}
              className="inline-flex items-center gap-[8px] text-[12.5px] font-semibold px-[13px] py-[8px] rounded-[9px] border border-ld-border-strong bg-ld-surface text-ld-text-2 transition-[color,border-color] duration-200 hover:text-ld-accent hover:border-ld-accent-line"
            >
              <Download className="w-[14px] h-[14px]" /> Export JSON
            </button>
            <button
              onClick={() => exportCsv(entries, url)}
              className="inline-flex items-center gap-[8px] text-[12.5px] font-semibold px-[13px] py-[8px] rounded-[9px] border border-ld-border-strong bg-ld-surface text-ld-text-2 transition-[color,border-color] duration-200 hover:text-ld-accent hover:border-ld-accent-line"
            >
              <FileText className="w-[14px] h-[14px]" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── CWV metric strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 max-[760px]:grid-cols-2 mt-[22px] border-t border-b border-ld-border">
        {metrics.map(({ label, value, band }, i) => (
          <div key={label} className={`px-[20px] py-[16px] text-center ${borderR(i)}`}>
            <p className="font-mono text-[10px] tracking-[.12em] uppercase text-ld-text-3">{label}</p>
            <p className={`font-mono text-[22px] font-semibold mt-[6px] ${BAND_CLS[band]}`}>{value}</p>
          </div>
        ))}
      </div>
    </>
  );
}
