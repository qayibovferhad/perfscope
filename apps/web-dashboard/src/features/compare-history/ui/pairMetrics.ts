import type { CompareEntry } from '@perfscope/shared';

/**
 * The performance score of one side of a comparison, rounded.
 *
 * Shared between the list and the chart it draws — a missing score reads as 0 here rather
 * than as a gap, because a stored comparison always has both sides.
 */
export const perf = (e: CompareEntry, side: 'source' | 'competitor'): number =>
  Math.round(e[side].scores['performance'] ?? 0);
