import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { OverviewVitalSplit } from '@perfscope/shared';
import { GLOSSARY, isVitalKey, type GlossaryKey } from '@/entities/analysis';
import { CHART, AXIS_PROPS, ChartTooltip } from '@/shared/ui/chart';

/**
 * Where every audited run lands in the web.dev bands, per metric.
 *
 * Counts runs rather than sites on purpose: the question is "which metric is most often
 * the problem", so a page audited fifty times should weigh more than one audited once.
 * Percentages are shown because the absolute counts differ per metric only by how many
 * runs recorded it.
 */

const SERIES = [
  { key: 'good',             label: 'Good',              color: CHART.accent },
  { key: 'needsImprovement', label: 'Needs improvement', color: CHART.amber },
  { key: 'poor',             label: 'Poor',              color: CHART.rose },
] as const;

export function VitalsSplitChart({ vitals }: { vitals: OverviewVitalSplit[] }) {
  const rows = vitals
    .map(row => ({
      ...row,
      total: row.good + row.needsImprovement + row.poor,
      label: isVitalKey(row.metric as GlossaryKey)
        ? GLOSSARY[row.metric as GlossaryKey].title
        : row.metric.toUpperCase(),
      abbr: row.metric.toUpperCase(),
    }))
    .filter(row => row.total > 0);

  if (!rows.length) {
    return <p className="text-[13px] text-ld-text-3 py-[14px]">No audits to break down yet.</p>;
  }

  return (
    <div className="flex flex-col gap-[10px]">
      <ResponsiveContainer width="100%" height={rows.length * 44 + 18}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
          <XAxis type="number" hide />
          <YAxis
            type="category" dataKey="abbr" {...AXIS_PROPS}
            width={44} tick={{ ...AXIS_PROPS.tick, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--ld-surface-hover)' }}
            content={
              <ChartTooltip
                formatValue={(value, key) => {
                  const row = rows.find(r => r[key as 'good' | 'needsImprovement' | 'poor'] === value);
                  const total = row?.total ?? 0;
                  return total ? `${value} · ${Math.round((value / total) * 100)}%` : String(value);
                }}
              />
            }
          />
          {SERIES.map((series, i) => (
            <Bar
              key={series.key}
              dataKey={series.key} name={series.label} stackId="band"
              fill={series.color} fillOpacity={0.85}
              radius={i === 0 ? [4, 0, 0, 4] : i === SERIES.length - 1 ? [0, 4, 4, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-[16px] gap-y-[6px]">
        {SERIES.map(series => (
          <span key={series.key} className="inline-flex items-center gap-[7px] text-[11.5px] text-ld-text-3">
            <i className="w-[9px] h-[9px] rounded-[2px] block not-italic shrink-0" style={{ background: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
    </div>
  );
}
