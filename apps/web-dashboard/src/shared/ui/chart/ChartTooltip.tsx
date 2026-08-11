/**
 * The tooltip body, styled as a panel rather than recharts' default white box.
 *
 * Written once because every chart wants the same thing: a heading, then one line per
 * series in that series' own colour. Recharts' default ignores the token system entirely
 * and is unreadable on the dark surface.
 *
 * Recharts injects `active`, `payload` and `label` into whatever it is given as
 * `content`, so those are optional here and the formatters are bound at the call site.
 */

interface TooltipRow {
  name?:    string;
  value?:   number | string;
  color?:   string;
  dataKey?: string | number;
}

interface Props {
  active?:  boolean;
  payload?: TooltipRow[];
  label?:   string | number;
  /** Formats a series value. `key` is the series dataKey, for per-metric units. */
  formatValue?: (value: number, key: string) => string;
  /** Formats the heading, e.g. an ISO day into "Aug 11". */
  formatLabel?: (label: string) => string;
}

export function ChartTooltip({ active, payload, label, formatValue, formatLabel }: Props) {
  if (!active || !payload?.length) return null;

  const heading = label === undefined ? '' : String(label);

  return (
    <div className="rounded-[10px] border border-ld-border bg-ld-surface shadow-ld-shadow-card px-[12px] py-[9px] pointer-events-none">
      {heading && (
        <b className="block text-[11.5px] font-semibold text-ld-text mb-[6px]">
          {formatLabel ? formatLabel(heading) : heading}
        </b>
      )}
      <div className="flex flex-col gap-[3px]">
        {payload.map((row, i) => (
          <span key={i} className="flex items-center gap-[7px] text-[11.5px] whitespace-nowrap">
            <span className="w-[8px] h-[8px] rounded-full shrink-0" style={{ background: row.color }} />
            <span className="text-ld-text-3">{row.name}</span>
            <b className="ml-auto pl-[12px] font-mono font-semibold text-ld-text">
              {typeof row.value === 'number' && formatValue
                ? formatValue(row.value, String(row.dataKey ?? ''))
                : row.value ?? '—'}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}
