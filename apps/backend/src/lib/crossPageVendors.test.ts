import { describe, it, expect } from 'vitest';
import { findSitewideVendors, describeSitewideVendor, type OtherRouteVendors } from './crossPageVendors.js';

const route = (routePath: string, vendors: Array<[string, number]>): OtherRouteVendors =>
  ({ routePath, vendors: vendors.map(([name, blockingTime]) => ({ name, blockingTime })) });

describe('findSitewideVendors', () => {
  it('reports a vendor that costs this page and at least two others', () => {
    // The point of the finding: this is not this page's problem, it is a vendor-governance
    // problem, and the fix is to remove it once rather than chase it page by page.
    const found = findSitewideVendors(
      [{ name: 'Tag Manager', blockingTime: 210.4 }],
      [route('/pricing', [['Tag Manager', 180]]), route('/blog', [['Tag Manager', 90]])],
    );
    expect(found).toEqual([{
      name: 'Tag Manager',
      hereMs: 210,
      otherRoutes: [{ routePath: '/pricing', blockingMs: 180 }, { routePath: '/blog', blockingMs: 90 }],
    }]);
  });

  it('ignores a vendor that only shows up on one other route', () => {
    // "Also happens to be on one other page" is not site-wide.
    expect(findSitewideVendors(
      [{ name: 'Tag Manager', blockingTime: 200 }],
      [route('/pricing', [['Tag Manager', 180]])],
    )).toEqual([]);
  });

  it('ignores a vendor that is cheap here', () => {
    expect(findSitewideVendors(
      [{ name: 'Pixel', blockingTime: 12 }],
      [route('/a', [['Pixel', 400]]), route('/b', [['Pixel', 400]])],
    )).toEqual([]);
  });

  it('does not count routes where the vendor is cheap', () => {
    // A vendor present everywhere at 2ms is not a finding anywhere.
    expect(findSitewideVendors(
      [{ name: 'Pixel', blockingTime: 300 }],
      [route('/a', [['Pixel', 2]]), route('/b', [['Pixel', 3]])],
    )).toEqual([]);
  });

  it('ranks by how many routes are affected, and lists the worst routes first', () => {
    const found = findSitewideVendors(
      [{ name: 'Wide', blockingTime: 100 }, { name: 'Narrow', blockingTime: 100 }],
      [
        route('/a', [['Wide', 60], ['Narrow', 60]]),
        route('/b', [['Wide', 300], ['Narrow', 60]]),
        route('/c', [['Wide', 120]]),
      ],
    );
    expect(found.map(v => v.name)).toEqual(['Wide', 'Narrow']);
    expect(found[0]?.otherRoutes.map(r => r.routePath)).toEqual(['/b', '/c', '/a']);
  });
});

describe('describeSitewideVendor', () => {
  it('agrees on one wording — the analyzer context and the advisor print the same line', () => {
    expect(describeSitewideVendor({
      name: 'Tag Manager', hereMs: 210,
      otherRoutes: [{ routePath: '/pricing', blockingMs: 180 }, { routePath: '/blog', blockingMs: 90 }],
    })).toBe('Tag Manager: 210ms here, and 2 other routes (/pricing 180ms, /blog 90ms)');
  });

  it('says "route" for a single one', () => {
    expect(describeSitewideVendor({ name: 'X', hereMs: 60, otherRoutes: [{ routePath: '/a', blockingMs: 60 }] }))
      .toContain('1 other route (');
  });
});
