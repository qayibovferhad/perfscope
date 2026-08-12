/**
 * Canonical display formatters, shared by the dashboard, the extension, and any
 * future surface — every panel shows the same value the same way.
 */

export const fmtMs = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`

/** Waterfall cells: a zero/negative duration means "didn't happen", shown as a dash. */
export const fmtMsOrDash = (ms: number): string => (ms <= 0 ? '—' : fmtMs(ms))

/** Vitals-style: always seconds with one decimal (e.g. "2.5s", "0.1s"). */
export const fmtSec = (ms: number): string => `${(ms / 1000).toFixed(1)}s`

/** Timeline/scrubber timestamps: always seconds with two decimals ("0.42s") — playback
 *  positions need the 10 ms resolution that fmtSec deliberately rounds away. */
export const fmtSec2 = (ms: number): string => `${(ms / 1000).toFixed(2)}s`

export const fmtCls = (v: number): string => v.toFixed(3)

export function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1_048_576).toFixed(1)} MB`
}

export const fmtBytesOrDash = (b: number): string => (b <= 0 ? '—' : fmtBytes(b))
