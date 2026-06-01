/** Threshold (percent) at which a metric delta is treated as a regression. */
export const REGRESSION_THRESHOLD_PCT = 15;

export const fmtMs  = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

export const fmtCls = (v: number): string => v.toFixed(3);

export const fmtPct = (n: number): string => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

export function fmtDateFull(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function deltaPct(curr: number, prev: number): number {
  return !prev ? 0 : ((curr - prev) / prev) * 100;
}

export function isReg(curr: number, prev: number): boolean {
  return deltaPct(curr, prev) > REGRESSION_THRESHOLD_PCT;
}
