import type { HistoryEntry } from '@perfscope/shared';

/**
 * A run that failed (unreachable host, Chrome crash, timeout) is still persisted, but
 * with every score and metric at 0. Those carry no signal: charted they draw a cliff to
 * zero, averaged they drag the score down. A real page always moves at least one of
 * these values.
 *
 * Mirrors HAS_RESULT on the server (website.routes.ts) and hasResult in history.service.
 */
export function hasResult(entry: HistoryEntry): boolean {
  const { performance, accessibility, bestPractices, seo } = entry.scores;
  if (performance || accessibility || bestPractices || seo) return true;

  const { fcp, lcp, tbt, cls, si, tti } = entry.metrics;
  return Boolean(fcp || lcp || tbt || cls || si || tti);
}
