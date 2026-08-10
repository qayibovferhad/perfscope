import { describe, it, expect } from 'vitest';
import type { HistoryEntry } from '@perfscope/shared';
import { hasResult } from './hasResult';

function entry(scores: Partial<HistoryEntry['scores']>, metrics: Partial<HistoryEntry['metrics']>): HistoryEntry {
  return {
    scores:  { performance: 0, accessibility: 0, bestPractices: 0, seo: 0, ...scores },
    metrics: { fcp: 0, lcp: 0, tbt: 0, cls: 0, si: 0, tti: 0, ...metrics },
  } as HistoryEntry;
}

describe('hasResult', () => {
  it('rejects an all-zero failed run', () => {
    expect(hasResult(entry({}, {}))).toBe(false);
  });

  it('accepts when any score moved', () => {
    expect(hasResult(entry({ seo: 80 }, {}))).toBe(true);
  });

  it('accepts when any metric moved', () => {
    expect(hasResult(entry({}, { cls: 0.01 }))).toBe(true);
  });
});
