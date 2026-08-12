import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ResponsiveContainer } from 'recharts';
import { SCORE_BANDS, type OverviewSiteTrend } from '@perfscope/shared';
import { CHART, SERIES_COLORS, AXIS_PROPS, GRID_PROPS, CURSOR_PROPS, ChartTooltip } from '@/shared/ui/chart';
import { fmtDayKey } from '@/shared/lib/time';
import { hasTrendData } from '../lib/hasChartData';

/**
 * Every site's performance score over the window, one line each.
 *
 * The banding is the reference the lines are read against — a line drifting out of the
 * green is the story, not its absolute height. Days without a run break the line rather
 * than being drawn through: interpolating would invent a measurement nobody took, and on
 * a nightly schedule with occasional failures those gaps are the interesting part.
 */
export function ScoreTrendChart({ trend, days }: { trend: OverviewSiteTrend[]; days: number }) {
  const withData = trend.filter(site => site.points.some(p => p.score !== null));

  if (!hasTrendData(trend)) {
    return (
      <p className="text-[13px] text-ld-text-3 py-[14px]">
        No audits in the last {days} days. Runs appear here as they happen — nightly audits
        keep the line moving without anyone remembering to press anything.
      </p>
    );
  }

  // Recharts wants one row per x value with a column per series.
  const rows = (withData[0]?.points ?? []).map((point, i) => {
    const row: Record<string, string | number | null> = { day: point.day };
    for (const site of withData) row[site.websiteId] = site.points[i]?.score ?? null;
    return row;
  });

  const nameById = new Map(withData.map(s => [s.websiteId, s.name]));

  return (
    // h-full + a flexible plot area: the panel decides the height so this chart and the
    // one beside it line up, instead of each being as tall as its own content happened to be.
    <div className="flex flex-col gap-[10px] h-full">
      <ResponsiveContainer width="100%" height="100%" className="flex-1 min-h-0">
        <LineChart data={rows} margin={{ top: 8, right: 22, bottom: 4, left: 0 }}>
          {/* web.dev bands: good ≥ 90, poor < 50. */}
          <ReferenceArea y1={SCORE_BANDS.good} y2={100} fill={CHART.accent} fillOpacity={0.06} />
          <ReferenceArea y1={SCORE_BANDS.needsImprovement} y2={SCORE_BANDS.good} fill={CHART.amber} fillOpacity={0.05} />
          <ReferenceArea y1={0} y2={SCORE_BANDS.needsImprovement} fill={CHART.rose} fillOpacity={0.05} />

          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="day" {...AXIS_PROPS} tickFormatter={fmtDayKey} minTickGap={34} />
          <YAxis {...AXIS_PROPS} domain={[0, 100]} ticks={[0, 50, 90, 100]} width={34} />

          <Tooltip
            cursor={CURSOR_PROPS}
            content={<ChartTooltip formatLabel={fmtDayKey} formatValue={(v) => String(Math.round(v))} />}
          />

          {withData.map((site, i) => (
            <Line
              key={site.websiteId}
              type="monotone"
              dataKey={site.websiteId}
              name={nameById.get(site.websiteId)}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              // Dots, not a bare line: a day whose neighbours are both empty has no
              // segment to be part of, and would otherwise render as nothing at all —
              // which is exactly the case on a site audited once or twice a week.
              dot={{ r: 2, fill: SERIES_COLORS[i % SERIES_COLORS.length], strokeWidth: 0 }}
              activeDot={{ r: 4, strokeWidth: 1.5, stroke: CHART.surface }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-[16px] gap-y-[6px]">
        {withData.map((site, i) => (
          <span key={site.websiteId} className="inline-flex items-center gap-[7px] text-[11.5px] text-ld-text-3">
            <i
              className="w-[14px] h-[3px] rounded-sm block not-italic shrink-0"
              style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
            {site.name}
          </span>
        ))}
      </div>
    </div>
  );
}
