import { describe, it, expect } from 'vitest';
import {
  diffResources,
  resourceDiffHasChanges,
  formatResourceDiff,
  snapshotOf,
  type ResourceSnapshot,
} from './resourceDiff.js';
import type { AnalysisResult } from '@perfscope/shared';

const KB = 1024;

const req = (url: string, transferSize: number, resourceType = 'script') =>
  ({ url, transferSize, resourceType });

const snap = (over: Partial<ResourceSnapshot> = {}): ResourceSnapshot =>
  ({ requests: [], detectedLibraries: [], thirdParty: [], ...over });

describe('diffResources — identity', () => {
  it('does not report a cache-buster as a removal plus an addition', () => {
    // Ad and analytics endpoints append a fresh `cb=` on every load. Keying on the raw URL
    // would make every audit of every page carrying one report churn that nobody caused.
    const current  = snap({ requests: [req('https://ads.test/pubads.js?cb=122880346', 50 * KB)] });
    const previous = snap({ requests: [req('https://ads.test/pubads.js?cb=122880269', 50 * KB)] });

    const diff = diffResources(current, previous);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(resourceDiffHasChanges(diff)).toBe(false);
  });

  it('still tells two different paths on the same origin apart', () => {
    const diff = diffResources(
      snap({ requests: [req('https://a.test/new.js', 10 * KB)] }),
      snap({ requests: [req('https://a.test/old.js', 10 * KB)] }),
    );
    expect(diff.added.map(r => r.url)).toEqual(['https://a.test/new.js']);
    expect(diff.removed.map(r => r.url)).toEqual(['https://a.test/old.js']);
  });

  it('falls back to a query-stripped string for an unparseable URL', () => {
    const diff = diffResources(
      snap({ requests: [req('not-a-url?v=2', 10 * KB)] }),
      snap({ requests: [req('not-a-url?v=1', 10 * KB)] }),
    );
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });
});

describe('diffResources — size changes', () => {
  it('reports a change only when it clears both the absolute and the relative bar', () => {
    const cases: Array<[label: string, from: number, to: number, counted: boolean]> = [
      // 300KB → 320KB: 20KB is over the byte floor but only 6% — a wobble on a big bundle.
      ['big file, small ratio',   300 * KB, 320 * KB, false],
      // 2KB → 2.6KB: 30% but only 600 bytes — a tracking pixel breathing.
      ['small file, small bytes',   2 * KB, 2.6 * KB, false],
      ['real growth',              20 * KB,  40 * KB, true],
    ];
    for (const [label, from, to, counted] of cases) {
      const diff = diffResources(
        snap({ requests: [req('https://a.test/app.js', to)] }),
        snap({ requests: [req('https://a.test/app.js', from)] }),
      );
      expect(diff.grown.length, label).toBe(counted ? 1 : 0);
    }
  });

  it('reports shrinking the same way as growth', () => {
    const diff = diffResources(
      snap({ requests: [req('https://a.test/app.js', 20 * KB)] }),
      snap({ requests: [req('https://a.test/app.js', 40 * KB)] }),
    );
    expect(diff.shrunk).toEqual([
      { url: 'https://a.test/app.js', resourceType: 'script', fromBytes: 40 * KB, toBytes: 20 * KB },
    ]);
    expect(diff.grown).toEqual([]);
  });

  it('handles a resource that was previously zero bytes without dividing by zero', () => {
    const diff = diffResources(
      snap({ requests: [req('https://a.test/app.js', 30 * KB)] }),
      snap({ requests: [req('https://a.test/app.js', 0)] }),
    );
    expect(diff.grown).toHaveLength(1);
  });
});

describe('diffResources — ranking and caps', () => {
  it('keeps the five heaviest additions, heaviest first', () => {
    const requests = Array.from({ length: 8 }, (_, i) => req(`https://a.test/${i}.js`, (i + 1) * 10 * KB));
    const diff = diffResources(snap({ requests }), snap());

    expect(diff.added).toHaveLength(5);
    expect(diff.added.map(r => r.transferSize)).toEqual([80, 70, 60, 50, 40].map(n => n * KB));
  });

  it('ranks size changes by magnitude, not by direction', () => {
    const diff = diffResources(
      snap({ requests: [req('https://a.test/small.js', 30 * KB), req('https://a.test/big.js', 500 * KB)] }),
      snap({ requests: [req('https://a.test/small.js', 10 * KB), req('https://a.test/big.js', 100 * KB)] }),
    );
    expect(diff.grown.map(g => g.url)).toEqual(['https://a.test/big.js', 'https://a.test/small.js']);
  });
});

describe('diffResources — libraries and vendors', () => {
  it('names what appeared and what went away', () => {
    const diff = diffResources(
      snap({
        detectedLibraries: [{ name: 'React' }, { name: 'lodash' }],
        thirdParty: [{ name: 'Google Analytics', transferSize: 0, mainThreadTime: 0 }],
      }),
      snap({
        detectedLibraries: [{ name: 'React' }, { name: 'jQuery' }],
        thirdParty: [{ name: 'Hotjar', transferSize: 0, mainThreadTime: 0 }],
      }),
    );
    expect(diff.librariesAdded).toEqual(['lodash']);
    expect(diff.librariesRemoved).toEqual(['jQuery']);
    expect(diff.vendorsAdded).toEqual(['Google Analytics']);
    expect(diff.vendorsRemoved).toEqual(['Hotjar']);
    expect(resourceDiffHasChanges(diff)).toBe(true);
  });
});

describe('formatResourceDiff', () => {
  it('names files by path and sizes in KB, one line per kind of change', () => {
    const lines = formatResourceDiff(diffResources(
      snap({ requests: [req('https://a.test/assets/hero.jpg', 400 * KB, 'image')] }),
      snap({ requests: [req('https://a.test/assets/old.js', 12 * KB)] }),
    ));
    expect(lines).toEqual([
      'Added: /assets/hero.jpg (400KB)',
      'Removed: /assets/old.js',
    ]);
  });

  it('says nothing at all when nothing changed', () => {
    // An empty list is what lets the callers skip the whole "what changed" block rather
    // than printing a heading with nothing under it.
    expect(formatResourceDiff(diffResources(snap(), snap()))).toEqual([]);
  });
});

describe('snapshotOf', () => {
  it('reads the three lists off a result, tolerating a result that carries none', () => {
    // The three callers built this literal inline and have to agree: a diff that counted
    // third parties in one place and not another would have the alert and the page
    // describing different changes.
    expect(snapshotOf({} as AnalysisResult)).toEqual({ requests: [], detectedLibraries: [], thirdParty: [] });

    const result = {
      resources: { requests: [req('https://a.test/a.js', 1)], detectedLibraries: [{ name: 'React' }] },
      thirdParty: [{ name: 'GA', transferSize: 0, mainThreadTime: 0 }],
    } as unknown as AnalysisResult;
    expect(snapshotOf(result).requests).toHaveLength(1);
    expect(snapshotOf(result).detectedLibraries).toEqual([{ name: 'React' }]);
    expect(snapshotOf(result).thirdParty).toHaveLength(1);
  });
});
