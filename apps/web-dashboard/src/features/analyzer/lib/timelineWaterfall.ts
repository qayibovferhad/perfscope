/**
 * Geometry and metric styling shared by TimelineWaterfall and its loading placeholder.
 *
 * The placeholder's job is to occupy exactly the space the real panel will, so nothing
 * shifts when the audit lands. It used to restate these numbers as literals and claim in
 * a docstring that they came "from the live component's own measurements" — true when it
 * was written, and unenforceable afterwards. Importing them is what makes the claim hold.
 */

/** Width of the resource-name column, left of the bars. */
export const LEFT_W = 280;

/** Height of the filmstrip/axis row above the lanes:
 *  top-pad(8) + thumb(45) + tick-line(6) + label(16) + bottom-pad(8). */
export const AXIS_ROW_H = 83;

/** Scrubber granularity. */
export const TICK_MS = 50;

// chipCls   — metric chip in the panel head
// labelCls  — small label above the scrubber track
// lineCls   — vertical tick on the scrubber track + row markers
export const METRICS_CFG = [
  {
    key: 'fcp' as const, label: 'FCP',
    chipCls:  'text-ld-teal border border-[rgba(22,200,200,.30)] bg-[rgba(22,200,200,.08)]',
    labelCls: 'text-ld-teal border border-[rgba(22,200,200,.40)] bg-ld-surface',
    lineCls:  'bg-ld-teal',
  },
  {
    key: 'lcp' as const, label: 'LCP',
    chipCls:  'text-[var(--ld-accent-2)] border border-ld-accent-line bg-ld-accent-soft',
    labelCls: 'text-ld-accent border border-ld-accent-line bg-ld-surface',
    lineCls:  'bg-ld-accent',
  },
  {
    key: 'tti' as const, label: 'TTI',
    chipCls:  'text-ld-amber border border-ld-amber-line bg-ld-amber-wash',
    labelCls: 'text-ld-amber border border-ld-amber-strong bg-ld-surface',
    lineCls:  'bg-ld-amber',
  },
] as const;
