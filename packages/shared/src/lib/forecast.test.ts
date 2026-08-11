import { describe, it, expect } from 'vitest'
import { forecastMetric, type ForecastSample } from './forecast'

/** Fixed calendar so every expectation is a plain arithmetic fact. */
const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString()

/** `values[i]` observed on day `i`, unless `days` overrides the spacing. */
function series(values: number[], days = values.map((_, i) => i)): ForecastSample[] {
  return values.map((value, i) => ({ at: day(days[i]!), value }))
}

describe('forecastMetric — guards', () => {
  it('returns null below three samples', () => {
    expect(forecastMetric('lcp', [])).toBeNull()
    expect(forecastMetric('lcp', series([2000]))).toBeNull()
    expect(forecastMetric('lcp', series([2000, 2100]))).toBeNull()
  })

  it('returns null when every sample shares a timestamp', () => {
    const at = day(0)
    expect(forecastMetric('lcp', [
      { at, value: 2000 },
      { at, value: 2400 },
      { at, value: 2800 },
    ])).toBeNull()
  })

  it('ignores unparseable timestamps and non-finite values when counting samples', () => {
    expect(forecastMetric('lcp', [
      { at: 'not-a-date', value: 2000 },
      { at: day(1), value: 2100 },
      { at: day(2), value: NaN },
      { at: day(3), value: 2300 },
    ])).toBeNull()
  })
})

describe('forecastMetric — clean trends', () => {
  it('reads a rising performance score as improving with a perfect fit', () => {
    const f = forecastMetric('performance', series([60, 63, 66, 69, 72, 75]))!
    expect(f).not.toBeNull()
    expect(f.slopePerDay).toBeCloseTo(3, 10)
    expect(f.r2).toBeCloseTo(1, 10)
    expect(f.current).toBe(75)
    expect(f.sampleCount).toBe(6)
    expect(f.direction).toBe('improving')
    expect(f.confidence).toBe('high')
  })

  it('projects the day a worsening LCP crosses its budget', () => {
    // 2000ms climbing 40ms/day; the newest run sits at 2200ms on day 5.
    const f = forecastMetric('lcp', series([2000, 2040, 2080, 2120, 2160, 2200]), 2500)!
    expect(f.direction).toBe('worsening')
    expect(f.slopePerDay).toBeCloseTo(40, 10)
    expect(f.confidence).toBe('high')
    // (2500 - 2200) / 40 = 7.5 days from the latest sample.
    expect(f.daysToBudget).toBe(7.5)
  })

  it('measures the slope in days, not in run count', () => {
    // Same five values, but spread over 20 days instead of 5.
    const f = forecastMetric('lcp', series([2000, 2100, 2200, 2300, 2400], [0, 5, 10, 15, 20]))!
    expect(f.slopePerDay).toBeCloseTo(20, 10)
  })

  it('sorts samples chronologically before fitting', () => {
    const ordered = forecastMetric('lcp', series([2000, 2100, 2200, 2300]))!
    const shuffled = forecastMetric('lcp', [
      { at: day(2), value: 2200 },
      { at: day(0), value: 2000 },
      { at: day(3), value: 2300 },
      { at: day(1), value: 2100 },
    ])!
    expect(shuffled.slopePerDay).toBeCloseTo(ordered.slopePerDay, 10)
    expect(shuffled.current).toBe(2300)
  })
})

describe('forecastMetric — direction inverts between scores and metrics', () => {
  const rising = [60, 63, 66, 69, 72, 75]

  it('calls a rising score improving and a rising metric worsening', () => {
    expect(forecastMetric('performance', series(rising))!.direction).toBe('improving')
    expect(forecastMetric('tbt', series(rising))!.direction).toBe('worsening')
  })

  it('calls a falling score worsening and a falling metric improving', () => {
    const falling = [...rising].reverse()
    expect(forecastMetric('performance', series(falling))!.direction).toBe('worsening')
    expect(forecastMetric('tbt', series(falling))!.direction).toBe('improving')
  })

  it('treats a score budget as a floor and a metric budget as a ceiling', () => {
    // Score sliding 3 points/day from 75 down to 60; floor of 51 is 3 days out.
    const score = forecastMetric('performance', series([75, 72, 69, 66, 63, 60]), 51)!
    expect(score.direction).toBe('worsening')
    expect(score.daysToBudget).toBe(3)

    // The same budget against a *rising* score is never crossed.
    expect(forecastMetric('performance', series([60, 63, 66, 69, 72, 75]), 51)!.daysToBudget).toBeNull()
  })
})

describe('forecastMetric — flat and noisy data', () => {
  it('calls a constant series flat with no crossing', () => {
    const f = forecastMetric('lcp', series([2000, 2000, 2000, 2000, 2000]), 2500)!
    expect(f.slopePerDay).toBe(0)
    expect(f.r2).toBe(1)
    expect(f.direction).toBe('flat')
    expect(f.daysToBudget).toBeNull()
  })

  it('calls drift below 2% of the metric scale over 30 days flat', () => {
    // 1ms/day = 30ms over 30 days, under the 50ms cutoff for LCP.
    const f = forecastMetric('lcp', series([2000, 2001, 2002, 2003, 2004]), 2500)!
    expect(f.direction).toBe('flat')
    expect(f.daysToBudget).toBeNull()

    // 2ms/day = 60ms over 30 days — now it counts.
    const g = forecastMetric('lcp', series([2000, 2002, 2004, 2006, 2008]), 2500)!
    expect(g.direction).toBe('worsening')
  })

  it('reports low confidence for noise that happens to have a slope', () => {
    const f = forecastMetric('lcp', series([2000, 2400, 1900, 2350, 1950, 2300]), 2500)!
    expect(f.r2).toBeLessThan(0.4)
    expect(f.confidence).toBe('low')
    // The forecast is still returned in full — the UI decides whether to show it.
    expect(f.sampleCount).toBe(6)
  })

  it('caps confidence at low for a tight line through only three points', () => {
    const f = forecastMetric('lcp', series([2000, 2100, 2200]))!
    expect(f.r2).toBeCloseTo(1, 10)
    expect(f.confidence).toBe('low')
  })

  it('reaches medium confidence at four decent samples', () => {
    const f = forecastMetric('lcp', series([2000, 2090, 2210, 2300]))!
    expect(f.r2).toBeGreaterThan(0.4)
    expect(f.confidence).toBe('medium')
  })
})

describe('forecastMetric — daysToBudget edges', () => {
  it('is null without a budget', () => {
    expect(forecastMetric('lcp', series([2000, 2040, 2080, 2120]))!.daysToBudget).toBeNull()
    expect(forecastMetric('lcp', series([2000, 2040, 2080, 2120]), null)!.daysToBudget).toBeNull()
  })

  it('is null when the budget is already breached', () => {
    const f = forecastMetric('lcp', series([2600, 2640, 2680, 2720]), 2500)!
    expect(f.current).toBe(2720)
    expect(f.direction).toBe('worsening')
    expect(f.daysToBudget).toBeNull()

    const score = forecastMetric('performance', series([50, 47, 44, 41]), 60)!
    expect(score.daysToBudget).toBeNull()
  })

  it('is null when the trend moves away from the budget', () => {
    expect(forecastMetric('lcp', series([2400, 2300, 2200, 2100]), 2500)!.daysToBudget).toBeNull()
  })

  it('is null when the crossing is more than ten years out', () => {
    // 1.7ms/day clears the flat cutoff but needs ~4100 days to travel 7000ms.
    const f = forecastMetric('lcp', series([1000, 1017, 1034, 1051], [0, 10, 20, 30]), 8000)!
    expect(f.direction).toBe('worsening')
    expect(f.daysToBudget).toBeNull()
  })

  it('never returns a negative crossing', () => {
    const budgets = [0.05, 0.1, 0.2, 0.3]
    for (const budget of budgets) {
      const f = forecastMetric('cls', series([0.05, 0.08, 0.11, 0.14, 0.17]), budget)!
      if (f.daysToBudget !== null) expect(f.daysToBudget).toBeGreaterThanOrEqual(0)
    }
  })

  it('projects a CLS crossing on the metric\'s own scale', () => {
    // 0.01/day from 0.05; newest run is 0.09 on day 4, budget 0.1 is 1 day away.
    const f = forecastMetric('cls', series([0.05, 0.06, 0.07, 0.08, 0.09]), 0.1)!
    expect(f.direction).toBe('worsening')
    expect(f.daysToBudget).toBeCloseTo(1, 5)
  })
})
