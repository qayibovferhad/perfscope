import { describe, it, expect } from 'vitest'
import {
  shouldMeasureAgain, spreadOf, MIN_RUNS, MAX_RUNS, STABLE_SPREAD, NOISY_SPREAD,
} from './measurement.js'

/** What the loop in lighthouse.service actually does, so a rule is tested end to end. */
function runsTaken(scores: number[], target: number): number {
  const taken: number[] = []
  for (const score of scores) {
    if (taken.length > 0 && !shouldMeasureAgain(taken, target)) break
    taken.push(score)
  }
  return taken.length
}

describe('spreadOf', () => {
  it('is zero below two runs — there is nothing to disagree with', () => {
    expect(spreadOf([])).toBe(0)
    expect(spreadOf([78])).toBe(0)
  })

  it('is best minus worst, not first minus last', () => {
    expect(spreadOf([67, 81, 78])).toBe(14)
    expect(spreadOf([81, 67])).toBe(14)
  })
})

describe('shouldMeasureAgain', () => {
  it('always takes at least MIN_RUNS', () => {
    expect(shouldMeasureAgain([78], 3)).toBe(true)
    expect(runsTaken([78, 78, 78], 3)).toBeGreaterThanOrEqual(MIN_RUNS)
  })

  it('stops at two when the page proved itself steady', () => {
    // The saving this exists for: a third run of 78, 79 measures nothing new.
    expect(shouldMeasureAgain([78, 79], 3)).toBe(false)
    expect(runsTaken([78, 79, 78], 3)).toBe(2)
  })

  it('reaches the target when the runs disagree but not wildly', () => {
    expect(shouldMeasureAgain([78, 72], 3)).toBe(true)   // spread 6: over stable, under noisy
    expect(runsTaken([78, 72, 75], 3)).toBe(3)
  })

  it('goes past the target while the spread stays noisy', () => {
    // 67, 81, 78 — the case that prompted this: a median over runs that disagree by 14.
    expect(shouldMeasureAgain([67, 81, 78], 3)).toBe(true)
    expect(runsTaken([67, 81, 78, 79, 80], 3)).toBe(MAX_RUNS)
  })

  it('never exceeds MAX_RUNS however unstable the page is', () => {
    expect(shouldMeasureAgain([10, 90, 50, 20, 80], 3)).toBe(false)
    expect(runsTaken([10, 90, 50, 20, 80, 30, 70], 3)).toBe(MAX_RUNS)
  })

  it('honours a target above MIN_RUNS only while the page is unsteady', () => {
    // A steady page ignores a high target — the point is to stop measuring what is settled.
    expect(runsTaken([80, 81, 80, 80, 80], 5)).toBe(2)
    expect(runsTaken([60, 75, 70, 72, 71], 5)).toBe(5)
  })

  it('treats the thresholds as the boundaries they are documented to be', () => {
    expect(shouldMeasureAgain([80, 80 + STABLE_SPREAD], 3)).toBe(false)      // exactly stable
    expect(shouldMeasureAgain([80, 80 + STABLE_SPREAD + 1], 3)).toBe(true)   // just over
    expect(shouldMeasureAgain([80, 80 + NOISY_SPREAD, 80], 3)).toBe(true)    // exactly noisy, past target
    expect(shouldMeasureAgain([80, 80 + NOISY_SPREAD - 1, 80], 3)).toBe(false)
  })
})
