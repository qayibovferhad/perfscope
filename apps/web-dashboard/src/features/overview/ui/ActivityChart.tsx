import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { OverviewActivityPoint } from '@perfscope/shared';
import { CHART, AXIS_PROPS, GRID_PROPS, ChartTooltip } from '@/shared/ui/chart';
import { fmtDayKey } from '@/shared/lib/time';
import { hasActivityData } from '../lib/hasChartData';

/**
 * Audits per day.
 *
 * Reads as a heartbeat: with nightly audits on, the bars are regular, and a run of empty
 * days means the schedule stopped firing — a failure that is otherwise invisible, because
 * nothing goes wrong loudly when an audit simply never happens.
 */


export function ActivityChart({ activity, days }: { activity: OverviewActivityPoint[]; days: number }) {
  if (!hasActivityData(activity)) {
    return (
      <p className="text-[13px] text-ld-text-3 py-[14px]">
        No audits in the last {days} days.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" className="flex-1 min-h-0">
      <BarChart data={activity} margin={{ top: 6, right: 20, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="day" {...AXIS_PROPS} tickFormatter={fmtDayKey} minTickGap={34} />
        <YAxis {...AXIS_PROPS} allowDecimals={false} width={28} />
        <Tooltip
          cursor={{ fill: 'var(--ld-surface-hover)' }}
          content={<ChartTooltip formatLabel={fmtDayKey} />}
        />
        <Bar
          dataKey="audits" name="Audits"
          fill={CHART.accent} radius={[3, 3, 0, 0]} maxBarSize={18}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
