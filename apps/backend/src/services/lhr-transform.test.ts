import { describe, it, expect } from 'vitest';
import type { RunnerResult } from 'lighthouse';
import {
  toScore,
  scoreToImpact,
  extractAuditDetails,
  buildAuditPlacements,
  extractFailingAudits,
  detectAuthRedirect,
  buildPartial,
  buildFullResult,
  type AuditPlacement,
} from './lhr-transform.js';

type Lhr = RunnerResult['lhr'];
type Audit = { score?: number | null; title?: string; description?: string; displayValue?: string; details?: unknown };

/** A minimal LHR — every test builds only the parts it asserts on. */
const lhrOf = (over: Partial<Record<string, unknown>> = {}): Lhr =>
  ({ audits: {}, categories: {}, ...over } as unknown as Lhr);

const failing = (score: number, over: Partial<Audit> = {}): Audit =>
  ({ score, title: 'Failing audit', description: 'Because.', ...over });

describe('toScore', () => {
  it('turns Lighthouse\'s 0-1 into the 0-100 the product speaks', () => {
    expect(toScore(0.9)).toBe(90);
    expect(toScore(0.955)).toBe(96);
  });

  it('reads a missing or null score as zero', () => {
    // A category that did not run has no score; a run that failed reports zeros, and
    // `hasResult` is what keeps those out of averages and budgets downstream.
    expect(toScore(null)).toBe(0);
    expect(toScore(undefined)).toBe(0);
  });
});

describe('scoreToImpact', () => {
  it('bands a score into the four impact levels', () => {
    expect(scoreToImpact(0)).toBe('critical');
    expect(scoreToImpact(0.24)).toBe('critical');
    expect(scoreToImpact(0.25)).toBe('high');
    expect(scoreToImpact(0.5)).toBe('medium');
    expect(scoreToImpact(0.75)).toBe('low');
  });

  it('treats an unscored audit as low, not as a failure', () => {
    // `score: null` means "not applicable to this page", which is not a finding.
    expect(scoreToImpact(null)).toBe('low');
  });
});

describe('extractAuditDetails', () => {
  it('normalises the shapes different audits use', () => {
    const details = extractAuditDetails({
      items: [
        { node: { selector: 'img.hero', snippet: '<img class="hero">' } },
        { url: 'https://a.test/app.js' },
        { wastedMs: 431.6 },
        { wastedBytes: 51_200 },
        { totalBytes: 102_400 },
      ],
    });
    expect(details).toEqual([
      { selector: 'img.hero', snippet: '<img class="hero">' },
      { url: 'https://a.test/app.js' },
      { value: '432ms wasted' },
      { value: '50KB wasted' },
      { value: '100KB' },
    ]);
  });

  it('keeps the last segment of an ancestor-chain selector', () => {
    // The useful part is the failing element itself. Truncating from the head cut the
    // class the AI prompt needed to cite off the end of the string.
    const [detail] = extractAuditDetails({ items: [{ node: { selector: 'div.Wrapper > div.Row > a.Link' } }] }) ?? [];
    expect(detail?.selector).toBe('… > a.Link');
  });

  it('truncates a URL from the front, keeping the filename', () => {
    const long = `https://a.test/${'x'.repeat(200)}/bundle.js`;
    const [detail] = extractAuditDetails({ items: [{ url: long }] }) ?? [];
    expect(detail?.url?.length).toBe(120);
    expect(detail?.url?.endsWith('bundle.js')).toBe(true);
  });

  it('keeps at most five rows — three unlabelled images explain themselves', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ url: `https://a.test/${i}.js` }));
    expect(extractAuditDetails({ items })).toHaveLength(5);
  });

  it('answers undefined rather than an empty list when there is nothing to say', () => {
    // The renderer and the prompt both branch on presence; an empty array would draw an
    // empty evidence block.
    expect(extractAuditDetails(undefined)).toBeUndefined();
    expect(extractAuditDetails({ items: [] })).toBeUndefined();
    expect(extractAuditDetails({ items: [{ irrelevant: true }] })).toBeUndefined();
  });

  it('attaches at most three screenshots per audit', () => {
    // The worker caps what it *takes*; this caps what gets stored, because one node can be
    // blamed by several audits and every row carries its own copy of the data URI.
    const items = Array.from({ length: 6 }, (_, i) => ({ node: { selector: `#el${i}`, lhId: `node-${i}` } }));
    const shots = Object.fromEntries(items.map((_, i) => [`node-${i}`, `data:image/webp;base64,shot${i}`]));

    const details = extractAuditDetails({ items }, shots) ?? [];
    expect(details.filter(d => d.screenshot)).toHaveLength(3);
  });

  it('spends a shared result-wide budget across audits', () => {
    const budget = { left: 1 };
    const one = (id: string) => extractAuditDetails(
      { items: [{ node: { selector: '#a', lhId: id } }] },
      { [id]: 'data:image/webp;base64,shot' },
      budget,
    );
    expect(one('node-a')?.[0]?.screenshot).toBeDefined();
    expect(one('node-b')?.[0]?.screenshot).toBeUndefined();
    expect(budget.left).toBe(0);
  });
});

describe('buildAuditPlacements', () => {
  const lhr = lhrOf({
    categoryGroups: { 'a11y-names-labels': { title: 'Names and labels' } },
    categories: {
      performance:   { auditRefs: [{ id: 'render-blocking-resources' }, { id: 'shared-audit' }] },
      accessibility: { auditRefs: [{ id: 'label', group: 'a11y-names-labels' }, { id: 'shared-audit' }] },
    },
  });

  it('reads the category and the group title off the LHR itself', () => {
    // Not a hard-coded list: Lighthouse would outgrow one at the next release.
    const placements = buildAuditPlacements(lhr);
    expect(placements.get('render-blocking-resources')).toEqual({ category: 'performance' });
    expect(placements.get('label')).toEqual({ category: 'accessibility', group: 'Names and labels' });
  });

  it('gives an audit referenced twice to the first category', () => {
    // The analyzer shows each audit once, and the first reference is the one whose score
    // it counts toward.
    expect(buildAuditPlacements(lhr).get('shared-audit')).toEqual({ category: 'performance' });
  });
});

describe('extractFailingAudits', () => {
  const audits = (n: number, prefix: string, score = 0.1): Record<string, Audit> =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}-${i}`, failing(score)]));

  it('keeps failing audits and drops passing and not-applicable ones', () => {
    const list = extractFailingAudits({
      bad:  failing(0.4),
      edge: failing(0.89),
      good: failing(0.9),          // 0.9 is a pass — the same 90 the score bands use
      na:   { score: null, title: 'Not applicable' },
    });
    expect(list.map(a => a.id).sort()).toEqual(['bad', 'edge']);
  });

  it('orders worst first', () => {
    expect(extractFailingAudits({ mid: failing(0.5), worst: failing(0), near: failing(0.8) }).map(a => a.id))
      .toEqual(['worst', 'mid', 'near']);
  });

  it('caps fifteen PER CATEGORY, not fifteen per LHR', () => {
    // The static run reports seo, best-practices and accessibility together. One shared cap
    // is what made the accessibility list show six rows while seo took the rest.
    const all = { ...audits(20, 'a11y'), ...audits(20, 'seo') };
    const placements = new Map<string, AuditPlacement>([
      ...Object.keys(audits(20, 'a11y')).map(id => [id, { category: 'accessibility' }] as [string, AuditPlacement]),
      ...Object.keys(audits(20, 'seo')).map(id => [id, { category: 'seo' }] as [string, AuditPlacement]),
    ]);

    const list = extractFailingAudits(all, placements);
    expect(list.filter(a => a.category === 'accessibility')).toHaveLength(15);
    expect(list.filter(a => a.category === 'seo')).toHaveLength(15);
  });

  it('still caps audits no category claims', () => {
    // An older LHR shape would otherwise slip past the cap entirely.
    expect(extractFailingAudits(audits(20, 'orphan'))).toHaveLength(15);
  });

  it('carries Lighthouse\'s own savings figures through', () => {
    const [item] = extractFailingAudits({
      'render-blocking-resources': failing(0.2, {
        details: { items: [{ url: 'https://a.test/app.css' }], overallSavingsMs: 431.4, overallSavingsBytes: 20_480 },
      }),
    });
    expect(item?.savingsMs).toBe(431);
    expect(item?.savingsBytes).toBe(20_480);
    expect(item?.details).toEqual([{ url: 'https://a.test/app.css' }]);
  });

  it('ignores a zero saving rather than reporting "0ms wasted"', () => {
    const [item] = extractFailingAudits({ x: failing(0.2, { details: { items: [{ url: 'u' }], overallSavingsMs: 0 } }) });
    expect(item?.savingsMs).toBeUndefined();
  });
});

describe('detectAuthRedirect', () => {
  it('flags a redirect that lands on something shaped like a login route', () => {
    for (const finalUrl of [
      'https://a.test/login',
      'https://a.test/users/sign_in',
      'https://accounts.other.test/oauth?next=/',
    ]) {
      expect(detectAuthRedirect('https://a.test/app', finalUrl)).toEqual({ finalUrl });
    }
  });

  it('does not flag an ordinary cross-origin redirect', () => {
    // wikipedia.org → www.wikipedia.org is a different origin and nothing to do with a
    // login wall; so is an apex→www hop or an http→https upgrade. Flagging those threw
    // away real audits as "login pages".
    expect(detectAuthRedirect('https://wikipedia.org/', 'https://www.wikipedia.org/')).toBeUndefined();
    expect(detectAuthRedirect('http://a.test/', 'https://a.test/')).toBeUndefined();
  });

  it('says nothing when there was no redirect, or the URLs are unusable', () => {
    expect(detectAuthRedirect('https://a.test/', 'https://a.test/')).toBeUndefined();
    expect(detectAuthRedirect(undefined, 'https://a.test/login')).toBeUndefined();
    expect(detectAuthRedirect('https://a.test/', 'not a url')).toBeUndefined();
  });
});

describe('buildPartial', () => {
  it('carries the score and the failing audits of one category', () => {
    const partial = buildPartial('analysis-1', 'seo', lhrOf({
      categories: { seo: { score: 0.82, auditRefs: [{ id: 'meta-description' }] } },
      audits: { 'meta-description': failing(0) },
    }));
    expect(partial).toMatchObject({ analysisId: 'analysis-1', category: 'seo', score: 82 });
    expect(partial.audits.map(a => a.id)).toEqual(['meta-description']);
    // Only the performance partial carries metrics — the static categories measure nothing.
    expect(partial.metrics).toBeUndefined();
  });

  it('attaches the vitals to the performance partial', () => {
    const partial = buildPartial('analysis-1', 'performance', lhrOf({
      categories: { performance: { score: 0.5, auditRefs: [] } },
      audits: {
        'first-contentful-paint':    { numericValue: 900 },
        'largest-contentful-paint':  { numericValue: 2400 },
        'total-blocking-time':       { numericValue: 310 },
        'cumulative-layout-shift':   { numericValue: 0.12 },
        'speed-index':               { numericValue: 1800 },
        interactive:                 { numericValue: 3200 },
      },
    }));
    expect(partial.metrics).toEqual({ fcp: 900, lcp: 2400, tbt: 310, cls: 0.12, si: 1800, tti: 3200 });
  });
});

describe('buildFullResult', () => {
  const perfLhr = lhrOf({
    requestedUrl: 'https://a.test/',
    finalDisplayedUrl: 'https://a.test/',
    categories: { performance: { score: 0.62, auditRefs: [{ id: 'render-blocking-resources' }] } },
    audits: {
      'render-blocking-resources': failing(0.2),
      'first-contentful-paint':   { numericValue: 900 },
      'largest-contentful-paint': { numericValue: 2400 },
      'total-blocking-time':      { numericValue: 310 },
      'cumulative-layout-shift':  { numericValue: 0 },
      'speed-index':              { numericValue: 1800 },
      interactive:                { numericValue: 3200 },
    },
  });

  const staticLhr = lhrOf({
    requestedUrl: 'https://a.test/',
    finalDisplayedUrl: 'https://a.test/',
    categories: {
      seo:              { score: 1,    auditRefs: [] },
      accessibility:    { score: 0.83, auditRefs: [{ id: 'label' }] },
      'best-practices': { score: 0.92, auditRefs: [] },
    },
    audits: { label: failing(0) },
  });

  it('merges the two runs into one result', () => {
    const result = buildFullResult('id-1', 'https://a.test/', [perfLhr, staticLhr]);
    expect(result.scores).toEqual({ performance: 62, accessibility: 83, bestPractices: 92, seo: 100 });
    expect(result.metrics.lcp).toBe(2400);
  });

  it('orders the merged audit list worst first, across categories', () => {
    // Concatenation order used to decide this, so the static run's findings came ahead of
    // every performance opportunity however bad it was — and the AI only ever sees the
    // first fourteen.
    const result = buildFullResult('id-1', 'https://a.test/', [staticLhr, perfLhr]);
    expect(result.audits.map(a => a.id)).toEqual(['label', 'render-blocking-resources']);
    expect(result.audits.map(a => a.category)).toEqual(['accessibility', 'performance']);
  });

  it('reports an audit found in both runs once', () => {
    const result = buildFullResult('id-1', 'https://a.test/', [perfLhr, perfLhr]);
    expect(result.audits.filter(a => a.id === 'render-blocking-resources')).toHaveLength(1);
  });

  it('flags a run that ended up on a login page', () => {
    const redirected = lhrOf({ ...perfLhr, requestedUrl: 'https://a.test/app', finalDisplayedUrl: 'https://a.test/login' });
    expect(buildFullResult('id-1', 'https://a.test/app', [redirected]).authRedirectDetected)
      .toEqual({ finalUrl: 'https://a.test/login' });
  });

  it('leaves the optional sections off when nothing produced them', () => {
    const result = buildFullResult('id-1', 'https://a.test/', [staticLhr]);
    expect(result.resources).toBeUndefined();     // no performance run, no network log
    expect(result.flameChartData).toBeUndefined();
    expect(result.bundles).toBeUndefined();
  });
});
