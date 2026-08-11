export { fmtMs, fmtCls } from '@/shared/lib/format';

export const fmtPct = (n: number): string => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

export function fmtDateFull(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Re-exported from the shared rule so the chart, the table and the alerting backend
// can never drift apart on what counts as a regression.
export { deltaPct, isRegression as isReg } from '@perfscope/shared';
