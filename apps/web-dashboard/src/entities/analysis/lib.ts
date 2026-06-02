// Hex values match the CSS design tokens exactly
export const SCORE_GOOD = '#10b981'; // var(--ps-healthy)
export const SCORE_WARN = '#f59e0b'; // var(--ps-amber)
export const SCORE_BAD  = '#ef4444'; // var(--ps-regression)

export function scoreColor(score: number): string {
  if (score >= 90) return SCORE_GOOD;
  if (score >= 50) return SCORE_WARN;
  return SCORE_BAD;
}
