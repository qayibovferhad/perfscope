import type { CompareEntry } from '@perfscope/shared';
import { fmtDay } from '@/shared/lib/time';
import { perf } from './pairMetrics';

// ─── Pair Chart ───────────────────────────────────────────────────────────────

const PC_VW  = 1000; const PC_VH = 300;
const PC_PAD = { top: 24, right: 32, bottom: 58, left: 56 } as const;
const PC_IW  = PC_VW - PC_PAD.left - PC_PAD.right;
const PC_IH  = PC_VH - PC_PAD.top  - PC_PAD.bottom;
const PC_MONO = "'Geist Mono', ui-monospace, monospace";

export function PairChart({ entries }: { entries: CompareEntry[] }) {
  const n = entries.length;
  if (!n) return null;

  const xOf     = (i: number) => PC_PAD.left + (n === 1 ? PC_IW / 2 : (i / (n - 1)) * PC_IW);
  const yScores = entries.map(e => perf(e, 'source'));
  const rScores = entries.map(e => perf(e, 'competitor'));
  const all     = [...yScores, ...rScores];
  const sMin    = Math.min(...all) * 0.88;
  const sMax    = Math.max(...all) * 1.06;
  const baseline = PC_PAD.top + PC_IH;
  const yOf     = (v: number) => PC_PAD.top + PC_IH - ((v - sMin) / (sMax - sMin || 1)) * PC_IH;

  const linePath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  const areaPath = (vals: number[]) => {
    const l   = vals.length;
    const pts = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
    return `${pts} L${xOf(l - 1).toFixed(1)},${baseline} L${xOf(0).toFixed(1)},${baseline} Z`;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: PC_PAD.top + PC_IH * (1 - t),
    v: Math.round(sMin + t * (sMax - sMin)),
  }));

  return (
    <svg
      viewBox={`0 0 ${PC_VW} ${PC_VH}`}
      style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}
      aria-label="Score comparison over time"
    >
      <defs>
        <linearGradient id="pairRivalFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--ld-amber)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--ld-amber)" stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="pairYouFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--ld-accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--ld-accent)" stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* Y-axis grid + labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PC_PAD.left} y1={t.y} x2={PC_VW - PC_PAD.right} y2={t.y}
            stroke="var(--ld-border)" strokeWidth="1" strokeDasharray="4 5"
          />
          <text
            x={PC_PAD.left - 8} y={t.y + 4}
            textAnchor="end" fill="var(--ld-text-3)"
            fontSize="11" fontFamily={PC_MONO}
          >
            {t.v}
          </text>
        </g>
      ))}

      {/* Rival area + line */}
      <path d={areaPath(rScores)} fill="url(#pairRivalFill)" />
      <path d={linePath(rScores)} fill="none" stroke="var(--ld-amber)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* You area + line */}
      <path d={areaPath(yScores)} fill="url(#pairYouFill)" />
      <path d={linePath(yScores)} fill="none" stroke="var(--ld-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Per-point dots + x-axis labels */}
      {entries.map((entry, i) => (
        <g key={i}>
          <circle cx={xOf(i)} cy={yOf(rScores[i]!)} r="4.5" fill="var(--ld-surface)" stroke="var(--ld-amber)"  strokeWidth="2" />
          <circle cx={xOf(i)} cy={yOf(yScores[i]!)} r="4.5" fill="var(--ld-surface)" stroke="var(--ld-accent)" strokeWidth="2" />
          <text
            x={xOf(i)} y={baseline + 18}
            textAnchor="middle" fill="var(--ld-text-3)"
            fontSize="11" fontFamily={PC_MONO}
          >
            {fmtDay(entry.timestamp)}
          </text>
        </g>
      ))}
    </svg>
  );
}
