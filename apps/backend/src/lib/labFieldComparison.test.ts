import { describe, it, expect } from 'vitest';
import { compareLabAndField, formatGapLines, rumAsFieldData } from './labFieldComparison.js';
import type { CruxData, CruxMetric, RumSummary } from '@perfscope/shared';

const metric = (p75: number, poor = 0.1): CruxMetric =>
  ({ p75, good: 0.6, needsImprovement: 0.3, poor });

const field = (metrics: CruxData['metrics']): CruxData => ({
  scope: 'url', url: 'https://a.test/', formFactor: 'mobile',
  collectedFrom: '2026-07-01', collectedTo: '2026-07-28', metrics,
});

const lab = { lcp: 2000, cls: 0.05, fcp: 1000 };

describe('compareLabAndField', () => {
  it('reports a metric where real users see it much worse than the lab did', () => {
    const [gap] = compareLabAndField(lab, field({ lcp: metric(4000, 0.35) }));
    expect(gap).toEqual({ metric: 'lcp', labValue: 2000, fieldP75: 4000, gap: 2000, poorShare: 0.35 });
  });

  it('reports the other direction too — the lab can be the pessimistic one', () => {
    // Worth saying out loud: a throttling profile harsher than the real audience is a
    // reason to trust the field number, not a reason to hide the comparison.
    const [gap] = compareLabAndField(lab, field({ lcp: metric(1000) }));
    expect(gap?.gap).toBe(-1000);
  });

  it('stays quiet when the two roughly agree', () => {
    expect(compareLabAndField(lab, field({ lcp: metric(2200) }))).toEqual([]);
  });

  it('skips metrics the field source has no data for', () => {
    expect(compareLabAndField(lab, field({}))).toEqual([]);
  });

  it('compares only the three metrics that mean the same thing on both sides', () => {
    // TBT has no clean field equivalent and SI/TTI are not in CrUX at all; comparing them
    // would be comparing two different measurements under one name.
    const gaps = compareLabAndField(lab, field({ lcp: metric(4000), cls: metric(0.3), fcp: metric(3000) }));
    expect(gaps.map(g => g.metric)).toEqual(['lcp', 'cls', 'fcp']);
  });

  it('uses a CLS-sized floor so a tiny shift is not a 100% gap', () => {
    // A page with no layout shift at all has lab CLS 0; against a field p75 of 0.002 the
    // ratio is infinite and the finding is noise.
    expect(compareLabAndField({ ...lab, cls: 0 }, field({ cls: metric(0.002) }))).toEqual([]);
    expect(compareLabAndField({ ...lab, cls: 0 }, field({ cls: metric(0.25) }))).toHaveLength(1);
  });
});

describe('formatGapLines', () => {
  it('renders one line per gap, formatted per metric', () => {
    const gaps = compareLabAndField(lab, field({ lcp: metric(4000, 0.35), cls: metric(0.4) }));
    expect(formatGapLines(gaps, { subject: 'real users\'', audience: 'real users' })).toEqual([
      "  LCP: lab 2.00s, real users' p75 4.00s — worse for real users",
      "  CLS: lab 0.050, real users' p75 0.400 — worse for real users",
    ]);
  });

  it('lets the caller carry its own extras and prefix', () => {
    const gaps = compareLabAndField(lab, field({ lcp: metric(1000) }));
    expect(formatGapLines(gaps, {
      subject: 'your visitors\'', audience: 'your visitors', prefix: '- ',
      suffix: () => ' (12 samples)', tail: () => '.',
    })).toEqual(["- LCP: lab 2.00s, your visitors' p75 1.00s (12 samples) — better for your visitors."]);
  });
});

describe('rumAsFieldData', () => {
  it('presents RUM in the CrUX shape so one comparison serves both sources', () => {
    const rum = {
      scope: 'path', path: '/pricing', device: 'mobile',
      from: '2026-07-01T00:00:00.000Z', to: '2026-07-28T00:00:00.000Z',
      pageViews: 120, metrics: { lcp: { p75: 3000, good: 0.5, needsImprovement: 0.3, poor: 0.2, samples: 90 } },
    } as unknown as RumSummary;

    expect(rumAsFieldData(rum, 'https://a.test/pricing')).toMatchObject({
      scope: 'url', url: 'https://a.test/pricing', formFactor: 'mobile',
      collectedFrom: '2026-07-01', collectedTo: '2026-07-28',
    });
  });

  it('maps whole-site RUM to origin scope and a mixed device to desktop', () => {
    // `device: 'all'` has no CrUX equivalent; CrUX always grades one form factor, and the
    // caller's own default for an unfiltered read is desktop.
    const rum = { scope: 'site', device: 'all', from: '2026-07-01T00:00:00.000Z', to: '2026-07-28T00:00:00.000Z', metrics: {} } as unknown as RumSummary;
    expect(rumAsFieldData(rum, 'https://a.test/')).toMatchObject({ scope: 'origin', formFactor: 'desktop' });
  });
});
