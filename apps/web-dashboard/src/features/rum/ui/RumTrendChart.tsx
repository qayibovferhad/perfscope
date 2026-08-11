import { VITAL_THRESHOLDS } from '@perfscope/shared';
import type { RumTrend } from '@perfscope/shared';
import { FIELD_METRICS, type FieldMetricKey } from '@/entities/analysis';

/**
 * Daily p75 over the window, drawn against the web.dev bands.
 *
 * The bands carry the meaning: a line that sits in the green is fine wherever it wobbles,
 * and one drifting into amber is the story regardless of its absolute numbers. Days with
 * no traffic break the line rather than interpolating a measurement nobody took.
 */

const VW = 720;
const VH = 130;
const PAD = { top: 10, right: 8, bottom: 18, left: 44 } as const;
const INNER_W = VW - PAD.left - PAD.right;
const INNER_H = VH - PAD.top - PAD.bottom;

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function RumTrendChart({ trend }: { trend: RumTrend }) {
  const meta = FIELD_METRICS[trend.metric as FieldMetricKey];
  const { good, poor } = VITAL_THRESHOLDS[trend.metric];

  const values = trend.points.map(p => p.p75).filter((v): v is number => v !== null);
  if (values.length < 2) {
    return (
      <p className="text-[12px] text-ld-text-3 py-[10px]">
        Not enough days with traffic yet to draw a trend.
      </p>
    );
  }

  // Keep the "good" threshold on screen even when every sample is far below it, so the
  // line is always read against the bar it has to clear.
  const max = Math.max(...values, good * 1.15);
  const min = 0;

  const x = (i: number) => PAD.left + (i / (trend.points.length - 1)) * INNER_W;
  const y = (v: number) => PAD.top + INNER_H - ((v - min) / (max - min || 1)) * INNER_H;

  // Contiguous runs only — a gap in traffic must not become a straight line across it.
  const segments: string[] = [];
  let current: string[] = [];
  trend.points.forEach((point, i) => {
    if (point.p75 === null) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(point.p75).toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(' '));

  const bandTop    = (v: number) => Math.max(PAD.top, y(v));
  const goodTop    = bandTop(good);
  const poorTop    = bandTop(poor);
  const axisBottom = PAD.top + INNER_H;

  const first = trend.points.find(p => p.p75 !== null);
  const last  = [...trend.points].reverse().find(p => p.p75 !== null);

  return (
    <div className="flex flex-col gap-[6px]">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="block w-full" role="img"
        aria-label={`${meta.label} p75 over ${trend.points.length} days`}>

        {/* Bands: good up to the threshold, then needs-improvement, then poor */}
        <rect x={PAD.left} y={goodTop} width={INNER_W} height={axisBottom - goodTop}
          className="fill-ld-accent" opacity={0.07} />
        <rect x={PAD.left} y={poorTop} width={INNER_W} height={goodTop - poorTop}
          className="fill-ld-amber" opacity={0.07} />
        <rect x={PAD.left} y={PAD.top} width={INNER_W} height={Math.max(0, poorTop - PAD.top)}
          className="fill-ld-rose" opacity={0.07} />

        <line x1={PAD.left} x2={VW - PAD.right} y1={goodTop} y2={goodTop}
          className="stroke-ld-accent" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />

        {/* Threshold labels */}
        <text x={PAD.left - 6} y={goodTop + 3} textAnchor="end"
          className="fill-ld-text-3 font-mono" fontSize={9}>
          {meta.format(good)}
        </text>
        <text x={PAD.left - 6} y={axisBottom + 3} textAnchor="end"
          className="fill-ld-text-3 font-mono" fontSize={9}>0</text>

        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" className="stroke-ld-accent-2" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {trend.points.map((point, i) =>
          point.p75 === null ? null : (
            <circle key={point.day} cx={x(i)} cy={y(point.p75)} r={2.5}
              className="fill-ld-accent-2">
              <title>{`${fmtDay(point.day)} · ${meta.format(point.p75)} · ${point.pageViews} views`}</title>
            </circle>
          ),
        )}
      </svg>

      <div className="flex justify-between font-mono text-[10px] text-ld-text-3 px-[2px]">
        <span>{first ? fmtDay(first.day) : ''}</span>
        <span>{last ? fmtDay(last.day) : ''}</span>
      </div>
    </div>
  );
}
