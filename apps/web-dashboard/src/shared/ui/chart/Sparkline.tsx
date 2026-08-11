import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { CHART } from './theme';

/**
 * A bare trend line — no axes, no grid, no tooltip.
 *
 * Shared rather than owned by the history feature: the dashboard's attention rows and
 * the history header both want the same 88×26 shape, and a second copy would drift.
 * The domain is the data's own range, not 0–100: over a handful of runs that all sit
 * near 50 an absolute scale draws a flat line and hides the movement worth seeing.
 */
export function Sparkline({
  values,
  width = 88,
  height = 26,
  color = CHART.accent,
  id,
}: {
  values: number[];
  width?:  number;
  height?: number;
  color?:  string;
  /** Gradient ids must be unique per instance or every sparkline reuses the first fill. */
  id:      string;
}) {
  if (values.length < 2) {
    return <span className="inline-block text-[11px] text-ld-text-3" style={{ width }}>—</span>;
  }

  const data = values.map((value, i) => ({ i, value }));
  const gradientId = `spark-${id}`;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone" dataKey="value"
            stroke={color} strokeWidth={2} strokeLinecap="round"
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
