import { describe, it, expect } from 'vitest';
import { targetProgress, collectTargetFailures, readTargetValue, TARGET_DIRECTION } from './targets';
import type { CoreWebVitals, PerformanceScores } from '../types/analysis';

const scores  = (performance: number): PerformanceScores =>
  ({ performance, accessibility: 100, bestPractices: 100, seo: 100 });
const vitals  = (v: Partial<CoreWebVitals> = {}): CoreWebVitals =>
  ({ fcp: 500, lcp: 2000, tbt: 100, cls: 0.05, si: 800, tti: 1200, ...v });

describe('direction', () => {
  it('treats performance as a floor and every vital as a ceiling', () => {
    // Getting this backwards inverts every verdict in the product, silently.
    expect(TARGET_DIRECTION.performance).toBe('floor');
    for (const m of ['lcp', 'tbt', 'cls', 'inp'] as const) {
      expect(TARGET_DIRECTION[m]).toBe('ceiling');
    }
  });
});

describe('targetProgress', () => {
  it('is unmet while below a floor and met once at or above it', () => {
    expect(targetProgress('performance', 61, 90)?.met).toBe(false);
    expect(targetProgress('performance', 90, 90)?.met).toBe(true);   // exactly on it counts
    expect(targetProgress('performance', 93, 90)?.met).toBe(true);
  });

  it('is unmet while above a ceiling and met once at or below it', () => {
    expect(targetProgress('lcp', 3300, 2500)?.met).toBe(false);
    expect(targetProgress('lcp', 2500, 2500)?.met).toBe(true);
    expect(targetProgress('lcp', 1900, 2500)?.met).toBe(true);
  });

  it('reports the gap as a distance still to cover, never a negative', () => {
    expect(targetProgress('performance', 61, 90)?.gap).toBe(29);
    expect(targetProgress('lcp', 3300, 2500)?.gap).toBe(800);
    expect(targetProgress('performance', 95, 90)?.gap).toBe(0);
    expect(targetProgress('lcp', 1000, 2500)?.gap).toBe(0);
  });

  it('gives a ratio that reflects how much is done, clamped to 0–1', () => {
    expect(targetProgress('performance', 45, 90)?.ratio).toBeCloseTo(0.5);
    expect(targetProgress('performance', 95, 90)?.ratio).toBe(1);
    // A ceiling starts its journey at twice the target, so 5000 against 2500 is nowhere.
    expect(targetProgress('lcp', 5000, 2500)?.ratio).toBe(0);
    expect(targetProgress('lcp', 3750, 2500)?.ratio).toBeCloseTo(0.5);
    // Far beyond bad must not go negative and wreck a progress bar.
    expect(targetProgress('lcp', 99_000, 2500)?.ratio).toBe(0);
  });

  it('returns null when the target is unset or the value unknown', () => {
    expect(targetProgress('lcp', 3000, null)).toBeNull();
    expect(targetProgress('lcp', 3000, undefined)).toBeNull();
    expect(targetProgress('lcp', null, 2500)).toBeNull();
  });
});

describe('readTargetValue', () => {
  it('reads performance from scores and vitals from metrics', () => {
    expect(readTargetValue('performance', scores(72), vitals())).toBe(72);
    expect(readTargetValue('lcp', scores(72), vitals({ lcp: 3100 }))).toBe(3100);
  });

  it('has no lab value for inp, which is field data', () => {
    expect(readTargetValue('inp', scores(72), vitals())).toBeNull();
  });
});

describe('collectTargetFailures', () => {
  it('returns only the targets that are missed', () => {
    const failures = collectTargetFailures(
      scores(61), vitals({ lcp: 3300, tbt: 90, cls: 0.02 }),
      { performance: 90, lcp: 2500, tbt: 200, cls: 0.1 },
    );
    expect(failures.map(f => f.metric).sort()).toEqual(['lcp', 'performance']);
  });

  it('is empty when everything is met', () => {
    expect(collectTargetFailures(scores(95), vitals(), { performance: 90, lcp: 2500 })).toEqual([]);
  });

  it('ignores metrics with no target set', () => {
    expect(collectTargetFailures(scores(10), vitals({ lcp: 9000 }), {})).toEqual([]);
  });

  it('never reports inp, which a lab run cannot measure', () => {
    const failures = collectTargetFailures(scores(95), vitals(), { inp: 1 });
    expect(failures).toEqual([]);
  });
});
