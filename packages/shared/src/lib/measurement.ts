/**
 * How many times a page has to be measured before the number means something.
 *
 * A single Lighthouse run swings by around ten points on the same page, so Precise mode
 * measures N times and reports the median run. N used to be a flat 3 for everyone, which
 * is wrong in both directions: a page that scores 78, 78, 79 spent a third of its wall
 * clock proving what the first two runs already agreed on, and a page that scores 67, 81,
 * 78 is handed to the reader as "78" with a fourteen-point disagreement underneath it.
 *
 * The spread decides instead. Stable pages stop early, unstable ones keep going.
 */

/** Below this, two runs agreeing is agreement — a third would measure nothing new. */
export const STABLE_SPREAD = 4

/**
 * At or above this the page measures unevenly and the reader is told so.
 *
 * Two tiers on purpose, and they were drifting before this file existed: the analyzer
 * warned at 8 while the AI prompt called a page "genuinely unstable" at 15. Both are
 * right — 8 is "don't treat one number as exact", 15 is "this page's own load behaviour
 * is unstable, not just measurement noise" — so both live here rather than as two
 * literals that happened to disagree.
 */
export const NOISY_SPREAD = 8
export const UNSTABLE_SPREAD = 15

/** Fewer than this and there is no spread to reason about at all. */
export const MIN_RUNS = 2
/** More than this and the wait stops being worth the extra precision. */
export const MAX_RUNS = 5

/** Points between the best and worst run — the whole basis of every decision here. */
export function spreadOf(scores: number[]): number {
  return scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0
}

/**
 * Should another timed run be measured, given what the runs so far scored?
 *
 * `target` is what the caller asked for (3 for Precise, 3 for the nightly cron). It is a
 * target rather than a count: the answer can come in under it when the page has already
 * proven itself steady, and can exceed it — up to MAX_RUNS — when the runs disagree
 * enough that the median is being computed over noise.
 *
 * Deliberately not "keep going until the spread is small". A genuinely unstable page
 * never converges, so that rule would run until MAX_RUNS every time on exactly the pages
 * whose audits are already the slowest.
 */
export function shouldMeasureAgain(scores: number[], target: number): boolean {
  const ran = scores.length
  const cap = Math.min(Math.max(target, MIN_RUNS), MAX_RUNS)

  if (ran >= MAX_RUNS) return false
  if (ran < MIN_RUNS) return true

  // Steady enough to call it, whatever the target was.
  if (spreadOf(scores) <= STABLE_SPREAD) return false

  if (ran < cap) return true

  // Past the target and still disagreeing: spend a little more rather than report a
  // median drawn from runs that do not agree on what this page does.
  return spreadOf(scores) >= NOISY_SPREAD
}
