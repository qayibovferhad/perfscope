/**
 * One place every chart reads its look from.
 *
 * Colours are passed as `var(--ld-*)` rather than hex: SVG presentation attributes are
 * parsed as CSS values, so the variables resolve normally and every chart follows the
 * light/dark toggle for free. Hard-coding hex here would silently break light theme,
 * which is exactly how the old hand-rolled charts started drifting apart.
 */

export const CHART = {
  accent: 'var(--ld-accent)',
  accent2: 'var(--ld-accent-2)',
  accentLine: 'var(--ld-accent-line)',
  amber:  'var(--ld-amber)',
  rose:   'var(--ld-rose)',
  teal:   'var(--ld-teal)',
  grid:   'var(--ld-border)',
  gridStrong: 'var(--ld-border-strong)',
  axis:   'var(--ld-text-3)',
  surface: 'var(--ld-surface)',
} as const;

/** Distinct lines for a multi-series chart. Ordered so the first few stay far apart. */
export const SERIES_COLORS = [
  CHART.accent,
  CHART.amber,
  CHART.teal,
  CHART.rose,
  'var(--ld-accent-deep)',
  'var(--ld-text-2)',
] as const;

export const MONO = "'Geist Mono', ui-monospace, monospace";

/** Shared axis styling — small, monospaced, and quiet enough to stay behind the data. */
export const AXIS_PROPS = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 11, fontFamily: MONO },
  tickLine: false,
  axisLine: false,
} as const;

export const GRID_PROPS = {
  stroke: CHART.grid,
  strokeDasharray: '4 5',
  vertical: false,
} as const;

/** Dashed vertical line under the cursor, matching the crosshair the old charts drew. */
export const CURSOR_PROPS = {
  stroke: 'var(--ld-border-strong)',
  strokeWidth: 1,
  strokeDasharray: '4 3',
} as const;
