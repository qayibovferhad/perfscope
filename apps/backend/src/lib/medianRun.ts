/**
 * Picking the run that represents the page, out of the several a precise audit measures.
 *
 * Lives here rather than in `lighthouse.service.ts` because it is the one piece of that
 * file with no Chrome, no worker and no I/O in it — and the one whose rule (median of
 * whole runs, lower of the middle pair) is worth pinning down in a test that does not
 * launch a browser.
 */
import type { RunnerResult } from 'lighthouse';
import type { MeasurementQuality } from '@perfscope/shared';
import { toScore } from '../services/lhr-transform.js';

/**
 * Pick the run that represents the page.
 *
 * The median is taken over whole runs rather than per metric so the reported
 * numbers stay internally consistent — the waterfall, filmstrip and trace all
 * belong to the same load as the score beside them. Averaging metrics would
 * produce a page that never actually existed.
 *
 * Run counts are no longer always odd: `shouldMeasureAgain` stops at two when a page
 * proves itself steady. With an even count this picks the lower of the middle pair, so a
 * two-run audit reports the worse of the two — deliberately. The runs are within
 * STABLE_SPREAD of each other by the time that happens, so the pessimism is a few points
 * at most, and a measurement tool that rounds towards flattering itself is worse than one
 * that rounds the other way.
 */
export function pickMedianRun<T extends { lhr: RunnerResult['lhr'] }>(
  runs: T[],
): { run: T; measurement: MeasurementQuality } {
  const scored = runs
    .map(run => ({ run, score: toScore(run.lhr.categories['performance']?.score) }))
    .sort((a, b) => a.score - b.score);

  const median = scored[Math.floor((scored.length - 1) / 2)]!;
  const scores = runs.map(run => toScore(run.lhr.categories['performance']?.score));
  const spread = scored.length > 1 ? scored[scored.length - 1]!.score - scored[0]!.score : 0;

  return { run: median.run, measurement: { runs: runs.length, scores, median: median.score, spread } };
}
