import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { VITAL_THRESHOLDS } from '@perfscope/shared';
import type { RumTrend } from '@perfscope/shared';
import { FIELD_METRICS, type FieldMetricKey } from '@/entities/analysis';
import { CHART, AXIS_PROPS, GRID_PROPS, CURSOR_PROPS, ChartTooltip } from '@/shared/ui/chart';

/**
 * Daily p75 over the window, drawn against the web.dev bands.
 *
 * The bands carry the meaning: a line that sits in the green is fine wherever it wobbles,
 * and one drifting into amber is the story regardless of its absolute numbers. Days with
 * no traffic break the line rather than interpolating a measurement nobody took — that is
 * `connectNulls={false}`, and it is the one behaviour this chart must not lose.
 */

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

  const data = trend.points.map(p => ({
    day: p.day,
    p75: p.p75,
    pageViews: p.pageViews,
  }));

  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="rum-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={CHART.accent2} stopOpacity={0.20} />
            <stop offset="100%" stopColor={CHART.accent2} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Bands, bottom-up: good, needs-improvement, poor. Clamped to the visible max. */}
        <ReferenceArea y1={0} y2={Math.min(good, max)} fill={CHART.accent} fillOpacity={0.07} />
        {max > good && (
          <ReferenceArea y1={good} y2={Math.min(poor, max)} fill={CHART.amber} fillOpacity={0.07} />
        )}
        {max > poor && (
          <ReferenceArea y1={poor} y2={max} fill={CHART.rose} fillOpacity={0.07} />
        )}
        <ReferenceLine
          y={good} stroke={CHART.accent} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.5}
        />

        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="day" {...AXIS_PROPS} tickFormatter={fmtDay} minTickGap={28} />
        <YAxis
          {...AXIS_PROPS}
          domain={[0, max]}
          tickFormatter={(v: number) => meta.format(v)}
          width={52}
        />

        <Tooltip
          cursor={CURSOR_PROPS}
          content={
            <ChartTooltip
              formatLabel={fmtDay}
              formatValue={(value, key) => (key === 'p75' ? meta.format(value) : String(value))}
            />
          }
        />

        <Area
          type="monotone" dataKey="p75" name={`${meta.label} p75`}
          stroke={CHART.accent2} strokeWidth={2} strokeLinecap="round"
          fill="url(#rum-trend-fill)"
          dot={{ r: 2.5, fill: CHART.accent2, strokeWidth: 0 }}
          activeDot={{ r: 4, fill: CHART.accent2, stroke: CHART.surface, strokeWidth: 1.5 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
