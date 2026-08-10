import { describe, it, expect } from 'vitest'
import { rateScore, rateVital, rateLcp, rateCls, rateTbt, VITAL_THRESHOLDS, type VitalKey } from './rating'

describe('rateScore', () => {
  it('follows the Lighthouse 90/50 bands', () => {
    expect(rateScore(100)).toBe('good')
    expect(rateScore(90)).toBe('good')
    expect(rateScore(89)).toBe('needs-improvement')
    expect(rateScore(50)).toBe('needs-improvement')
    expect(rateScore(49)).toBe('poor')
    expect(rateScore(0)).toBe('poor')
  })
})

describe('rateVital', () => {
  it('treats the good threshold as inclusive (web.dev semantics)', () => {
    expect(rateVital('lcp', 2500)).toBe('good')
    expect(rateVital('lcp', 2501)).toBe('needs-improvement')
    expect(rateVital('lcp', 4000)).toBe('needs-improvement')
    expect(rateVital('lcp', 4001)).toBe('poor')
  })

  it('covers every metric key with good < poor', () => {
    for (const key of Object.keys(VITAL_THRESHOLDS) as VitalKey[]) {
      const { good, poor } = VITAL_THRESHOLDS[key]
      expect(good).toBeLessThan(poor)
      expect(rateVital(key, 0)).toBe('good')
      expect(rateVital(key, poor * 2)).toBe('poor')
    }
  })

  it('backs the legacy per-metric helpers', () => {
    expect(rateLcp(2000)).toBe('good')
    expect(rateCls(0.3)).toBe('poor')
    expect(rateTbt(300)).toBe('needs-improvement')
  })
})
