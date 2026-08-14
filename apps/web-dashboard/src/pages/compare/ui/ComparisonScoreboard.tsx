import { Trophy } from 'lucide-react';
import { SIDE_TEXT, sideOf } from './sides';
import type { AnalysisResult, CoreWebVitals } from '@/entities/analysis';
import { fmtMs, fmtCls } from '@/shared/lib/format';

const CIRC = 2 * Math.PI * 72; // r=72 → ≈ 452.4

const METRICS: { key: keyof CoreWebVitals; abbr: string; label: string; fmt: (v: number) => string }[] = [
  { key: 'lcp', abbr: 'LCP', label: 'Largest Contentful Paint', fmt: fmtMs  },
  { key: 'fcp', abbr: 'FCP', label: 'First Contentful Paint',   fmt: fmtMs  },
  { key: 'tbt', abbr: 'TBT', label: 'Total Blocking Time',      fmt: fmtMs  },
  { key: 'si',  abbr: 'SI',  label: 'Speed Index',              fmt: fmtMs  },
  { key: 'cls', abbr: 'CLS', label: 'Cumulative Layout Shift',  fmt: fmtCls },
];

// ─── Score gauge ──────────────────────────────────────────────────────────────

function Gauge({ score, side }: { score: number; side: 'you' | 'rival' }) {
  const offset = CIRC * (1 - score / 100);
  const isYou  = side === 'you';
  return (
    <div className="relative w-[168px] h-[168px] mx-auto mb-[14px]">
      <svg className="-rotate-90 w-[168px] h-[168px]" viewBox="0 0 168 168">
        <circle cx="84" cy="84" r="72" fill="none" strokeWidth="11" className="stroke-ld-border" />
        <circle
          cx="84" cy="84" r="72" fill="none"
          strokeWidth="11" strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          className={[
            'transition-[stroke-dashoffset] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
            isYou
              ? 'stroke-ld-accent drop-shadow-[0_0_8px_var(--ld-accent-soft)]'
              : 'stroke-ld-amber  drop-shadow-[0_0_8px_rgba(230,162,60,0.13)]',
          ].join(' ')}
        />
      </svg>
      <div className={`absolute inset-0 grid place-items-center font-mono text-[50px] font-semibold tracking-[-0.03em]
        ${SIDE_TEXT[sideOf(isYou)]}`}>
        {score}
      </div>
    </div>
  );
}

// ─── Winner pill ──────────────────────────────────────────────────────────────

function WinnerPill({ wins, tied, side }: { wins: boolean; tied: boolean; side: 'you' | 'rival' }) {
  const isYou = side === 'you';

  if (tied) {
    return (
      <span className="inline-flex items-center gap-[6px] font-mono text-[11px] font-semibold tracking-[.08em] uppercase mt-[10px] px-[12px] py-[5px] rounded-full border border-ld-border bg-ld-surface-2 text-ld-text-3">
        Tied
      </span>
    );
  }
  if (!wins) {
    return (
      <span className="inline-flex items-center gap-[6px] font-mono text-[11px] font-semibold tracking-[.08em] uppercase mt-[10px] px-[12px] py-[5px] rounded-full border border-ld-border bg-ld-surface-2 text-ld-text-3">
        Runner-up
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-[6px] font-mono text-[11px] font-semibold tracking-[.08em] uppercase mt-[10px] px-[12px] py-[5px] rounded-full border
      ${isYou
        ? 'text-ld-accent-2 border-ld-accent-line bg-ld-accent-soft'
        : 'text-ld-amber border-[rgba(230,162,60,0.34)] bg-[rgba(230,162,60,0.13)]'}`}
    >
      <Trophy className="w-[13px] h-[13px]" />
      Overall winner
    </span>
  );
}

// ─── Diverging metric bar ─────────────────────────────────────────────────────

function MetricBar({ abbr, label, tVal, cVal, fmt }: {
  abbr: string; label: string; tVal: number; cVal: number; fmt: (v: number) => string;
}) {
  const maxVal = Math.max(tVal, cVal, 0.0001);
  const youW   = (tVal / maxVal) * 46; // % of full track (max 46 so it stays within the half)
  const rivalW = (cVal / maxVal) * 46;
  const rel    = Math.abs(tVal - cVal) / maxVal;
  const isTie  = rel < 0.03;
  const tLeads = !isTie && tVal < cVal; // lower is better for all these metrics
  const cLeads = !isTie && cVal < tVal;

  return (
    <div className="grid items-center gap-x-3 py-[11px] border-b border-ld-border last:border-b-0
      grid-cols-[110px_54px_1fr_54px_90px] max-[760px]:grid-cols-[80px_auto_1fr_auto]">

      {/* Metric label */}
      <div className="min-w-0">
        <b className="font-mono text-[13px] font-semibold text-ld-text block">{abbr}</b>
        <span className="text-[10.5px] text-ld-text-3 hidden sm:block">{label}</span>
      </div>

      {/* You value */}
      <div className="text-right">
        <span className={`font-mono text-[12px] font-semibold tabular-nums ${tLeads ? 'text-ld-accent-2' : 'text-ld-text-3'}`}>
          {fmt(tVal)}
        </span>
      </div>

      {/* Diverging track */}
      <div className="relative h-[10px] flex items-center col-span-1 max-[760px]:col-span-2 max-[760px]:order-last max-[760px]:mt-1">
        {/* Center divider */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] bg-ld-border-strong -translate-x-1/2 z-10" />
        {/* You bar — grows leftward from center */}
        <div
          className="absolute right-1/2 h-[10px] rounded-[5px] mr-[1.5px] bg-gradient-to-r from-ld-accent-soft to-ld-accent"
          style={{ width: `${youW}%` }}
        />
        {/* Rival bar — grows rightward from center */}
        <div
          className="absolute left-1/2 h-[10px] rounded-[5px] ml-[1.5px] bg-gradient-to-r from-ld-amber to-[rgba(230,162,60,0.13)]"
          style={{ width: `${rivalW}%` }}
        />
      </div>

      {/* Rival value */}
      <div className="max-[760px]:text-right">
        <span className={`font-mono text-[12px] font-semibold tabular-nums ${cLeads ? 'text-ld-amber' : 'text-ld-text-3'}`}>
          {fmt(cVal)}
        </span>
      </div>

      {/* Verdict badge */}
      <div className="flex justify-end max-[760px]:hidden">
        {isTie ? (
          <span className="font-mono text-[10.5px] font-semibold px-[9px] py-[4px] rounded-full border border-ld-border text-ld-text-3 whitespace-nowrap">
            Tie
          </span>
        ) : tLeads ? (
          <span className="font-mono text-[10.5px] font-semibold px-[9px] py-[4px] rounded-full border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2 whitespace-nowrap">
            You lead
          </span>
        ) : cLeads ? (
          <span className="font-mono text-[10.5px] font-semibold px-[9px] py-[4px] rounded-full border border-[rgba(230,162,60,0.34)] bg-[rgba(230,162,60,0.13)] text-ld-amber whitespace-nowrap">
            Rival leads
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ComparisonScoreboard({
  target, competitor,
}: {
  target: AnalysisResult; competitor: AnalysisResult;
}) {
  const tScore = Math.round(target.scores.performance);
  const cScore = Math.round(competitor.scores.performance);
  const diff   = Math.abs(tScore - cScore);
  const tied   = diff === 0;
  const youWin = tScore > cScore;

  return (
    <div className="rounded-[20px] border border-ld-border bg-ld-surface shadow-ld-shadow-card p-[26px]">

      {/* ── Section head ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-[11px] mb-[22px]">
        <div className="w-8 h-8 rounded-[9px] grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent shrink-0">
          <Trophy className="w-[16px] h-[16px]" />
        </div>
        <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ld-text">Performance Scoreboard</h2>
      </div>

      {/* ── Scoreboard 3-col ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-5 items-center max-[760px]:grid-cols-1 mb-[28px]">

        {/* You */}
        <div className="text-center">
          <Gauge score={tScore} side="you" />
          <div className="text-[15px] font-bold text-ld-text">Your Site</div>
          <WinnerPill wins={youWin} tied={tied} side="you" />
        </div>

        {/* Center diff */}
        <div className="text-center px-[12px] max-[760px]:order-first max-[760px]:py-4">
          <div className="font-mono text-[10px] tracking-[.14em] uppercase text-ld-text-3 mb-2">
            Points diff
          </div>
          <div className="font-mono text-[42px] font-semibold tracking-[-0.03em] text-ld-text leading-none mb-[14px]">
            {diff > 0 && (
              <span className={SIDE_TEXT[sideOf(youWin)]}>+</span>
            )}
            {diff}
          </div>
          <div className="w-[44px] h-[44px] rounded-full grid place-items-center mx-auto font-mono text-[13px] font-bold text-ld-text-3 border border-ld-border-strong bg-ld-surface-2">
            VS
          </div>
        </div>

        {/* Rival */}
        <div className="text-center">
          <Gauge score={cScore} side="rival" />
          <div className="text-[15px] font-bold text-ld-text">Competitor</div>
          <WinnerPill wins={!youWin} tied={tied} side="rival" />
        </div>
      </div>

      {/* ── Bar table header ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-[110px_54px_1fr_54px_90px] gap-x-3 pb-[8px] mb-[2px] max-[760px]:grid-cols-[80px_auto_1fr_auto]">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-ld-text-3">Metric</span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-ld-accent-2 text-right">You</span>
        <div className="flex items-center justify-between px-[2px]">
          <span className="font-mono text-[9px] text-ld-accent-2 opacity-60">← You</span>
          <span className="font-mono text-[9px] text-ld-amber opacity-60">Rival →</span>
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-ld-amber">Rival</span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-ld-text-3 text-right max-[760px]:hidden">Status</span>
      </div>

      {/* ── Metric rows ──────────────────────────────────────────────────── */}
      <div>
        {METRICS.map(({ key, abbr, label, fmt }) => (
          <MetricBar
            key={key}
            abbr={abbr}
            label={label}
            tVal={target.metrics[key]}
            cVal={competitor.metrics[key]}
            fmt={fmt}
          />
        ))}
      </div>
    </div>
  );
}
