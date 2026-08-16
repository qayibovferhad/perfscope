import { SCORE_BANDS, VITAL_THRESHOLDS, TARGET_DIRECTION, fmtMs, fmtCls } from '@perfscope/shared';
import type { TargetMetric } from '@perfscope/shared';

/** The five targets a site can set, in the order they are worth thinking about. */
export const TARGET_FIELDS: {
  metric: TargetMetric;
  label:  string;
  /** What the number means, in the unit the input takes. */
  hint:   string;
  /** web.dev's "good" value, read from the shared table so it cannot drift. */
  suggested: number;
  /** Field-only: no lab run produces it, so it is never judged by an audit. */
  fieldOnly?: boolean;
}[] = [
  { metric: 'performance', label: 'Performance score', hint: 'out of 100', suggested: SCORE_BANDS.good },
  { metric: 'lcp',         label: 'LCP',               hint: 'ms',         suggested: VITAL_THRESHOLDS.lcp.good },
  { metric: 'tbt',         label: 'TBT',               hint: 'ms',         suggested: VITAL_THRESHOLDS.tbt.good },
  { metric: 'cls',         label: 'CLS',               hint: 'shift score', suggested: VITAL_THRESHOLDS.cls.good },
  { metric: 'inp',         label: 'INP',               hint: 'ms · field only', suggested: VITAL_THRESHOLDS.inp.good, fieldOnly: true },
];

/** `≥` for a score, `≤` for everything else — the direction lives in the shared table. */
export const comparatorFor = (metric: TargetMetric) =>
  TARGET_DIRECTION[metric] === 'floor' ? '≥' : '≤';

/** A target or a measurement, in the unit a person reads it in. */
export function fmtTarget(metric: TargetMetric, value: number): string {
  if (metric === 'performance') return String(Math.round(value));
  if (metric === 'cls')         return fmtCls(value);
  return fmtMs(value);
}
