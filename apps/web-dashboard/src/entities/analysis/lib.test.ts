import { describe, it, expect } from 'vitest';
import { scoreBand, vitalBand, scoreColor, SCORE_GOOD, SCORE_WARN, SCORE_BAD } from './lib';

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
