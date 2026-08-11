import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { isRegression } from '@perfscope/shared';
import type { HistoryEntry } from '@/entities/history';
import { fmtMs } from '@/shared/lib/format';
import { CHART, AXIS_PROPS, GRID_PROPS, CURSOR_PROPS, MONO } from '@/shared/ui/chart';

// Re-exported so existing importers keep resolving it from here.
export { isRegression };

/**
 * LCP and TBT over successive runs.
 *
 * The two metrics keep independent scales — TBT is measured in tens of milliseconds
 * where LCP is in thousands, so a shared axis would flatten TBT into the baseline and
 * hide exactly the movement this chart exists to show. Only the LCP axis is labelled;
 * the point of the TBT line is its shape, not its absolute pixel height.
 *
 * The panel above owns the detailed hover card, so this reports the active index rather
 * than drawing a tooltip of its own — the cursor line is the only thing rendered.
 */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Row {
  date:       string;
  shortId:    string;
  lcp:        number;
  tbt:        number;
  regression: boolean;
}

/** Two-line category tick: the date, and the run's short id beneath it. */
function DateTick({ x, y, payload, rows }: {
  x?: number; y?: number; payload?: { index?: number; value?: string }; rows: Row[];
}) {
  const row = rows[payload?.index ?? -1];
  if (!row || x === undefined || y === undefined) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill={CHART.axis} fontSize={11} fontFamily={MONO} dy={14}>
        {row.date}
      </text>
      <text textAnchor="middle" fill={CHART.axis} fontSize={9} fontFamily={MONO} opacity={0.5} dy={30}>
        #{row.shortId}
      </text>
    </g>
  );
}

/** A run that got materially worse than the one before it gets a halo and a label. */
function LcpDot({ cx, cy, index, rows, hoveredIdx }: {
  cx?: number; cy?: number; index?: number; rows: Row[]; hoveredIdx: number | null;
}) {
  if (cx === undefined || cy === undefined || index === undefined) return null;
  const row = rows[index];
  if (!row) return null;

  if (row.regression) {
    // A centred label runs off the plot on the first and last runs — and the most recent
    // run is exactly where a regression is most likely to be. Anchor it inward instead.
    const anchor = index === rows.length - 1 ? 'end' : index === 0 ? 'start' : 'middle';
    return (
      <g>
        <circle cx={cx} cy={cy} r={13} fill="rgba(242,100,122,0.14)" />
        <circle cx={cx} cy={cy} r={6.5} fill={CHART.rose} />
        <text
          x={cx} y={cy - 20} textAnchor={anchor} fill={CHART.rose}
          fontSize={11} fontWeight={700} fontFamily={MONO} letterSpacing="0.07em"
        >
          REGRESSION
        </text>
      </g>
    );
  }
  return (
    <circle
      cx={cx} cy={cy} r={hoveredIdx === index ? 6 : 4.5}
      fill={CHART.surface} stroke={CHART.accent} strokeWidth={2}
    />
  );
}

export function EvolutionChart({
  entries,
  hoveredIdx,
  onHover,
}: {
  entries:    HistoryEntry[];
  hoveredIdx: number | null;
  onHover:    (i: number | null) => void;
}) {
  if (!entries.length) return null;

  const rows: Row[] = entries.map((entry, i) => {
    const prev = entries[i - 1];
    return {
      date:    fmtDate(entry.timestamp),
      shortId: entry.shortId,
      lcp:     entry.metrics.lcp,
      tbt:     entry.metrics.tbt,
      regression: prev
        ? isRegression(entry.metrics.lcp, prev.metrics.lcp) || isRegression(entry.metrics.tbt, prev.metrics.tbt)
        : false,
    };
  });

  // Matches the old framing: a little air under the lowest point and above the highest,
  // so a flat series does not render as a line pinned to the axis.
  const pad = (values: number[]): [number, number] =>
    [Math.min(...values) * 0.85, Math.max(...values) * 1.1];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={rows}
        margin={{ top: 28, right: 16, bottom: 34, left: 8 }}
        onMouseMove={(state) => {
          const i = (state as { activeTooltipIndex?: number }).activeTooltipIndex;
          onHover(typeof i === 'number' ? i : null);
        }}
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <linearGradient id="ev-lcp-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={CHART.accent} stopOpacity={0.20} />
            <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ev-tbt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={CHART.amber} stopOpacity={0.16} />
            <stop offset="100%" stopColor={CHART.amber} stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid {...GRID_PROPS} />

        <XAxis
          dataKey="date"
          {...AXIS_PROPS}
          interval="preserveStartEnd"
          tick={<DateTick rows={rows} />}
          height={38}
        />
        <YAxis
          yAxisId="lcp"
          {...AXIS_PROPS}
          domain={pad(rows.map(r => r.lcp))}
          tickFormatter={(v: number) => fmtMs(v)}
          width={58}
        />
        {/* TBT rides its own hidden scale — see the note at the top of the file. */}
        <YAxis yAxisId="tbt" hide domain={pad(rows.map(r => r.tbt))} />

        {/* Renders the crosshair only; the panel above owns the readout. */}
        <Tooltip cursor={CURSOR_PROPS} content={() => null} />

        <Area
          yAxisId="tbt" type="linear" dataKey="tbt" name="TBT"
          stroke={CHART.amber} strokeWidth={2.5} fill="url(#ev-tbt-fill)"
          dot={{ r: 4.5, fill: CHART.surface, stroke: CHART.amber, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: CHART.surface, stroke: CHART.amber, strokeWidth: 2 }}
          isAnimationActive={false}
        />
        <Area
          yAxisId="lcp" type="linear" dataKey="lcp" name="LCP"
          stroke={CHART.accent} strokeWidth={2.5} fill="url(#ev-lcp-fill)"
          dot={<LcpDot rows={rows} hoveredIdx={hoveredIdx} />}
          activeDot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
