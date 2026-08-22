import { describe, it, expect } from 'vitest';
import { scoreBand, vitalBand, scoreColor, deltaOf, SCORE_GOOD, SCORE_WARN, SCORE_BAD } from './lib';

describe('scoreBand', () => {
  it('maps ScoreRating to the compact display band', () => {
    expect(scoreBand(95)).toBe('good');
    expect(scoreBand(70)).toBe('warn');
    expect(scoreBand(20)).toBe('poor');
  });
});

describe('vitalBand', () => {
  it('shares thresholds with @perfscope/shared', () => {
    expect(vitalBand('cls', 0.05)).toBe('good');
    expect(vitalBand('cls', 0.2)).toBe('warn');
    expect(vitalBand('tbt', 700)).toBe('poor');
  });
});

describe('scoreColor', () => {
  it('derives from the same bands', () => {
    expect(scoreColor(95)).toBe(SCORE_GOOD);
    expect(scoreColor(60)).toBe(SCORE_WARN);
    expect(scoreColor(10)).toBe(SCORE_BAD);
  });
});

describe('deltaOf', () => {
  it('returns null without a baseline', () => {
    expect(deltaOf('score', 80, undefined)).toBeNull();
    expect(deltaOf('score', 80, null)).toBeNull();
  });

  it('reads a higher score as better and a lower one as worse', () => {
    expect(deltaOf('score', 84, 70)).toEqual({ diff: 14, direction: 'better', meaningful: true });
    expect(deltaOf('score', 56, 70)).toEqual({ diff: -14, direction: 'worse', meaningful: true });
  });

  it('keeps a score move inside SCORE_NOISE_POINTS unmeaningful', () => {
    // 8 points is under the 10-point floor scoreVerdict uses — shown, but muted.
    expect(deltaOf('score', 78, 70)).toEqual({ diff: 8, direction: 'better', meaningful: false });
  });

  it('reads a lower vital as better', () => {
    const d = deltaOf('lcp', 1800, 2600);
    expect(d).toEqual({ diff: -800, direction: 'better', meaningful: true });
  });

  it('requires both the absolute floor and the percentage for a vital', () => {
    // 60ms on 2500ms: clears METRIC_NOISE.lcp (100) neither way — and 2.4% is under 15%.
    expect(deltaOf('lcp', 2560, 2500)?.meaningful).toBe(false);
    // 40ms on 100ms is 40%, but under the 100ms absolute floor for LCP.
    expect(deltaOf('lcp', 140, 100)?.meaningful).toBe(false);
    // 500ms on 2500ms clears both.
    expect(deltaOf('lcp', 3000, 2500)?.meaningful).toBe(true);
  });

  it('judges fcp/si/tti on percentage alone — they have no absolute floor', () => {
    expect(deltaOf('si', 140, 100)?.meaningful).toBe(true);
    expect(deltaOf('si', 105, 100)?.meaningful).toBe(false);
  });

  it('reports an unchanged value as same', () => {
    expect(deltaOf('cls', 0.1, 0.1)).toEqual({ diff: 0, direction: 'same', meaningful: false });
  });
});
