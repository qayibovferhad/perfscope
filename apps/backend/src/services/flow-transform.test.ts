import { describe, it, expect } from 'vitest';
import type { Result as LhrResult } from 'lighthouse';
import { buildFlowStepResult } from './flow-transform.js';

/** An LHR as one flow step produces it. `gatherMode` is what decides everything here. */
const lhr = (over: Record<string, unknown> = {}): LhrResult => ({
  gatherMode: 'navigation',
  categories: {},
  audits: {},
  ...over,
} as unknown as LhrResult);

const metric = (value: number) => ({ numericValue: value, score: 1 });

describe('buildFlowStepResult — a navigation step', () => {
  const step = {
    name: 'Page load',
    lhr: lhr({
      categories: {
        performance:      { score: 0.87, auditRefs: [] },
        accessibility:    { score: 0.91, auditRefs: [] },
        'best-practices': { score: 1,    auditRefs: [] },
        seo:              { score: 0.82, auditRefs: [] },
      },
      audits: {
        'largest-contentful-paint': metric(2400),
        'first-contentful-paint':   metric(900),
        'total-blocking-time':      metric(120),
        'cumulative-layout-shift':  metric(0.03),
        'speed-index':              metric(1800),
        interactive:                metric(3100),
        'interaction-to-next-paint': metric(999),   // present but meaningless here
      },
    }),
  };

  it('reports everything a cold load measures', () => {
    const result = buildFlowStepResult(step);
    expect(result.mode).toBe('navigation');
    expect(result.scores).toEqual({ performance: 87, accessibility: 91, bestPractices: 100, seo: 82 });
    expect(result.metrics).toEqual({ lcp: 2400, fcp: 900, tbt: 120, cls: 0.03, si: 1800, tti: 3100 });
  });

  it('and nothing a cold load does not', () => {
    // A navigation's INP is not an interaction anybody performed; carrying it would put a
    // number on screen that describes nothing.
    expect(buildFlowStepResult(step).metrics.inp).toBeUndefined();
  });
});

describe('buildFlowStepResult — a timespan step', () => {
  const step = {
    name: 'Open the panel',
    lhr: lhr({
      gatherMode: 'timespan',
      categories: { performance: { score: 0.82, auditRefs: [] } },
      audits: {
        'interaction-to-next-paint': metric(324),
        'total-blocking-time':       metric(257),
        'cumulative-layout-shift':   metric(0),
        'largest-contentful-paint':  metric(2400),   // Lighthouse carries it; it means nothing
      },
    }),
  };

  it('reports the interaction — INP is the reason this mode exists', () => {
    const result = buildFlowStepResult(step, 'Click #open');
    expect(result.mode).toBe('timespan');
    expect(result.metrics).toEqual({ inp: 324, tbt: 257, cls: 0 });
    expect(result.scores).toEqual({ performance: 82 });
    expect(result.action).toBe('Click #open');
  });

  it('drops the load metrics — nothing was loading', () => {
    const result = buildFlowStepResult(step);
    expect(result.metrics.lcp).toBeUndefined();
    expect(result.metrics.fcp).toBeUndefined();
  });
});

describe('buildFlowStepResult — a snapshot step', () => {
  const step = {
    name: 'Final state',
    lhr: lhr({
      gatherMode: 'snapshot',
      categories: {
        // Lighthouse scores a snapshot's performance 0 because it has no timing to score.
        performance:      { score: 0,    auditRefs: [] },
        accessibility:    { score: 0.86, auditRefs: [] },
        'best-practices': { score: 0.86, auditRefs: [] },
        seo:              { score: 0.5,  auditRefs: [] },
      },
      audits: { 'total-blocking-time': metric(0) },
    }),
  };

  it('never reports that zero as a performance score', () => {
    // This is the whole reason the transform is mode-aware: printing it would tell the
    // reader the page scored zero, which is a measurement nobody took.
    const result = buildFlowStepResult(step);
    expect(result.scores.performance).toBeUndefined();
    expect(result.scores.accessibility).toBe(86);
  });

  it('and reports no timing at all', () => {
    expect(buildFlowStepResult(step).metrics).toEqual({});
  });
});

describe('buildFlowStepResult — audits', () => {
  const failing = (score: number, title: string) => ({ score, title });

  it('keeps failing audits worst first, capped at ten', () => {
    const audits: Record<string, unknown> = {};
    for (let i = 0; i < 15; i++) audits[`a${i}`] = failing(i / 100, `Audit ${i}`);

    const result = buildFlowStepResult({ name: 'x', lhr: lhr({ audits }) });
    expect(result.audits).toHaveLength(10);
    expect(result.audits[0]?.title).toBe('Audit 0');
  });

  it('drops passing and not-applicable ones', () => {
    const result = buildFlowStepResult({
      name: 'x',
      lhr: lhr({ audits: {
        bad:  failing(0.3, 'Bad'),
        good: failing(0.95, 'Good'),
        na:   { score: null, title: 'Not applicable' },
      } }),
    });
    expect(result.audits.map(a => a.id)).toEqual(['bad']);
  });

  it('reads the category from the LHR rather than guessing it', () => {
    const result = buildFlowStepResult({
      name: 'x',
      lhr: lhr({
        categories: { accessibility: { score: 0.5, auditRefs: [{ id: 'label' }] } },
        audits: { label: { score: 0, title: 'Form elements have labels', displayValue: '3 elements' } },
      }),
    });
    expect(result.audits[0]).toMatchObject({ category: 'accessibility', displayValue: '3 elements' });
  });
});
