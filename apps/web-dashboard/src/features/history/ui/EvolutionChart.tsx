import type { HistoryEntry } from '@/entities/history';
import { fmtMs } from '@/shared/lib/format';

// ─── Chart geometry ───────────────────────────────────────────────────────────

const VW      = 1000;
const VH      = 300;
const PAD     = { top: 28, right: 32, bottom: 56, left: 68 } as const;
const INNER_W = VW - PAD.left - PAD.right;
const INNER_H = VH - PAD.top  - PAD.bottom;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REGRESSION_PCT = 15;

export function isRegression(curr: number, prev: number) {
  return !prev ? false : ((curr - prev) / prev) * 100 > REGRESSION_PCT;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function linePath(pts: { x: number; y: number }[]) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EvolutionChart({
  entries,
  hoveredIdx,
  onHover,
}: {
  entries:    HistoryEntry[];
  hoveredIdx: number | null;
  onHover:    (i: number | null) => void;
}) {
  const n = entries.length;
  if (n < 1) return null;

  const xOf = (i: number) =>
    PAD.left + (n === 1 ? INNER_W / 2 : (i / (n - 1)) * INNER_W);

  function yScale(key: 'lcp' | 'tbt') {
    const vals = entries.map(e => e.metrics[key]);
    const min  = Math.min(...vals) * 0.85;
    const max  = Math.max(...vals) * 1.10;
    return (v: number) => PAD.top + INNER_H - ((v - min) / (max - min || 1)) * INNER_H;
  }

  const lcpY   = yScale('lcp');
  const tbtY   = yScale('tbt');
  const lcpPts = entries.map((e, i) => ({ x: xOf(i), y: lcpY(e.metrics.lcp) }));
  const tbtPts = entries.map((e, i) => ({ x: xOf(i), y: tbtY(e.metrics.tbt) }));

  const baseline = PAD.top + INNER_H;
  const lcpArea  = lcpPts.length > 1
    ? `${linePath(lcpPts)} L${lcpPts.at(-1)!.x.toFixed(1)},${baseline} L${lcpPts[0]!.x.toFixed(1)},${baseline} Z`
    : '';
  const tbtArea  = tbtPts.length > 1
    ? `${linePath(tbtPts)} L${tbtPts.at(-1)!.x.toFixed(1)},${baseline} L${tbtPts[0]!.x.toFixed(1)},${baseline} Z`
    : '';

  // Y-axis ticks on LCP scale
  const lcpVals = entries.map(e => e.metrics.lcp);
  const lcpMin  = Math.min(...lcpVals) * 0.85;
  const lcpMax  = Math.max(...lcpVals) * 1.10;
  const yTicks  = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: PAD.top + INNER_H * (1 - t),
    v: lcpMin + t * (lcpMax - lcpMin),
  }));

  const MONO = "'Geist Mono', ui-monospace, monospace";

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}
      aria-label="LCP and TBT evolution chart"
    >
      <defs>
        <linearGradient id="ev-lcp-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--ld-accent)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--ld-accent)" stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="ev-tbt-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--ld-amber)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--ld-amber)" stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* Y-axis grid + labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD.left} y1={t.y} x2={VW - PAD.right} y2={t.y}
            stroke="var(--ld-border)" strokeWidth="1" strokeDasharray="4 5"
          />
          <text
            x={PAD.left - 8} y={t.y + 4}
            textAnchor="end" fill="var(--ld-text-3)"
            fontSize="11" fontFamily={MONO}
          >
            {fmtMs(t.v)}
          </text>
        </g>
      ))}

      {/* Hover crosshair */}
      {hoveredIdx !== null && (
        <line
          x1={xOf(hoveredIdx)} y1={PAD.top}
          x2={xOf(hoveredIdx)} y2={PAD.top + INNER_H}
          stroke="var(--ld-border-strong)" strokeWidth="1" strokeDasharray="4 3"
        />
      )}

      {/* LCP area + line */}
      {lcpArea && <path d={lcpArea} fill="url(#ev-lcp-fill)" />}
      <path
        d={linePath(lcpPts)} fill="none"
        stroke="var(--ld-accent)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
      />

      {/* TBT area + line */}
      {tbtArea && <path d={tbtArea} fill="url(#ev-tbt-fill)" />}
      <path
        d={linePath(tbtPts)} fill="none"
        stroke="var(--ld-amber)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
      />

      {/* Per-entry: dots, regression markers, x-axis labels */}
      {entries.map((entry, i) => {
        const prev   = entries[i - 1];
        const hasReg = prev
          ? isRegression(entry.metrics.lcp, prev.metrics.lcp) || isRegression(entry.metrics.tbt, prev.metrics.tbt)
          : false;
        const lY    = lcpY(entry.metrics.lcp);
        const tY    = tbtY(entry.metrics.tbt);
        const isHov = hoveredIdx === i;
        const x     = xOf(i);

        return (
          <g key={i}>
            {hasReg ? (
              <>
                {/* Rose halo + filled dot */}
                <circle cx={x} cy={lY} r="13" fill="rgba(242,100,122,0.14)" />
                <circle cx={x} cy={lY} r="6.5" fill="var(--ld-rose)" />
                {/* REGRESSION label above dot */}
                <text
                  x={x} y={lY - 20}
                  textAnchor="middle" fill="var(--ld-rose)"
                  fontSize="11" fontWeight="700" fontFamily={MONO}
                  letterSpacing="0.07em"
                >
                  REGRESSION
                </text>
              </>
            ) : (
              <circle
                cx={x} cy={lY} r={isHov ? 6 : 4.5}
                fill="var(--ld-surface)" stroke="var(--ld-accent)" strokeWidth="2"
                style={{ transition: 'r 0.15s' }}
              />
            )}

            {/* TBT dot */}
            <circle
              cx={x} cy={tY} r={isHov ? 6 : 4.5}
              fill="var(--ld-surface)" stroke="var(--ld-amber)" strokeWidth="2"
              style={{ transition: 'r 0.15s' }}
            />

            {/* X-axis: date */}
            <text
              x={x} y={PAD.top + INNER_H + 18}
              textAnchor="middle" fill="var(--ld-text-3)"
              fontSize="11" fontFamily={MONO}
            >
              {fmtDate(entry.timestamp)}
            </text>
            {/* X-axis: commit hash */}
            <text
              x={x} y={PAD.top + INNER_H + 34}
              textAnchor="middle" fill="var(--ld-text-3)"
              fontSize="9" fontFamily={MONO} opacity="0.5"
            >
              #{entry.shortId}
            </text>

            {/* Invisible hover target */}
            <rect
              x={x - 24} y={PAD.top} width={48} height={INNER_H}
              fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
            />
          </g>
        );
      })}
    </svg>
  );
}
