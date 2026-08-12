export { fmtMs, fmtCls } from '@/shared/lib/format';

export const fmtPct = (n: number): string => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

export { fmtDateTime as fmtDateFull } from '@/shared/lib/time';

// Re-exported from the shared rule so the chart, the table and the alerting backend
// can never drift apart on what counts as a regression.
export { deltaPct, isRegression as isReg, scoreVerdict } from '@perfscope/shared';
