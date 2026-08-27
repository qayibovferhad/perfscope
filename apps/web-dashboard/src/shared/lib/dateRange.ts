import type { OverviewRange } from '@perfscope/shared';

/**
 * The vocabulary the date-range picker writes days in — month names, the preset shape and
 * the two labels built from them.
 *
 * Beside the component rather than inside it because a file that exports both a component
 * and a value cannot fast-refresh, and `rangeLabel` is read by the dashboard header as
 * well: the page title and the picker's trigger must never name different windows.
 */
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface RangePreset {
  days:  number;
  label: string;
}

/** "24 Aug" / "24 Aug 2025" — the year only when it is not this one, which is most of the
 *  time not worth the width. */
export function shortDay(day: string, thisYear: string): string {
  const [y, m, d] = day.split('-') as [string, string, string];
  const month = MONTHS[Number(m) - 1]?.slice(0, 3) ?? m;
  return `${Number(d)} ${month}${y === thisYear ? '' : ` ${y}`}`;
}

/** What the trigger says: a preset by name, or the range itself. */
export function rangeLabel(range: OverviewRange, presets: RangePreset[], today: string): string {
  const preset = range.to === today && presets.find(p => p.days === range.days);
  if (preset) return preset.label;
  return range.from === range.to
    ? shortDay(range.from, today.slice(0, 4))
    : `${shortDay(range.from, today.slice(0, 4))} – ${shortDay(range.to, today.slice(0, 4))}`;
}
