import { describe, expect, it } from 'vitest'
import {
  METRIC_NOISE,
  SCORE_NOISE_POINTS,
  detectRegressions,
  isRegression,
  scoreVerdict,
} from './regression.js'

describe('scoreVerdict', () => {
  it('treats a run-to-run wobble as stable', () => {
    // The reason this file exists: 5 and 10 point swings were being reported as verdicts,
    // and two runs of an unchanged page routinely differ by that much.
    for (const delta of [1, 3, 5, 8, 10]) {
      expect(scoreVerdict(70 + delta, 70)).toBe('stable')
      expect(scoreVerdict(70 - delta, 70)).toBe('stable')
    }
  })

  it('needs more than the noise band to call it', () => {
    expect(scoreVerdict(70 + SCORE_NOISE_POINTS + 1, 70)).toBe('improved')
    expect(scoreVerdict(70 - SCORE_NOISE_POINTS - 1, 70)).toBe('regressed')
  })
})

describe('isRegression', () => {
  it('ignores a large percentage over a tiny absolute move', () => {
    // +33%, and 10ms no one could measure twice the same way.
    expect(isRegression('tbt', 40, 30)).toBe(false)
    expect(isRegression('lcp', 1050, 1000)).toBe(false)
  })

  it('fires when both the percentage and the absolute move are real', () => {
    expect(isRegression('tbt', 300, 200)).toBe(true)
    expect(isRegression('lcp', 3000, 2000)).toBe(true)
    expect(isRegression('cls', 0.2, 0.1)).toBe(true)
  })

  it('needs the growth to clear the floor even at a big percentage', () => {
    const justUnder = 0.1 + METRIC_NOISE.cls - 0.001
    expect(isRegression('cls', justUnder, 0.1)).toBe(false)
  })

  it('has no verdict without a baseline, and none for an improvement', () => {
    expect(isRegression('lcp', 4000, 0)).toBe(false)
    expect(isRegression('lcp', 1000, 4000)).toBe(false)
  })
})

describe('detectRegressions', () => {
  const run = (performance: number, lcp: number, tbt: number, cls: number) => ({
    scores:  { performance },
    metrics: { lcp, tbt, cls },
  })

  it('stays quiet when nothing moved beyond the noise', () => {
    expect(detectRegressions(run(62, 2050, 240, 0.11), run(70, 2000, 220, 0.10))).toEqual([])
  })

  it('reports the score and every timing that regressed', () => {
    const findings = detectRegressions(run(55, 3000, 500, 0.30), run(80, 2000, 200, 0.10))
    expect(findings.map((f) => f.metric)).toEqual(['performance', 'lcp', 'tbt', 'cls'])
  })

  it('agrees with scoreVerdict on the score', () => {
    const borderline = detectRegressions(run(60, 2000, 200, 0.1), run(70, 2000, 200, 0.1))
    expect(borderline).toEqual([])
    expect(scoreVerdict(60, 70)).toBe('stable')
  })
})
