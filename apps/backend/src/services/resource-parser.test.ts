import { describe, it, expect } from 'vitest';
import type { Result as LhrResult } from 'lighthouse';
import { parseResources } from './resource-parser.js';

const KB = 1024;

interface NetItem {
  url: string; resourceType?: string; transferSize?: number; resourceSize?: number;
  statusCode?: number; mimeType?: string;
  rendererStartTime?: number; networkRequestTime?: number; networkEndTime?: number;
}

const lhrWith = (network: NetItem[], summary?: unknown[]): LhrResult => ({
  audits: {
    'network-requests': { details: { type: 'table', items: network } },
    ...(summary ? { 'resource-summary': { details: { type: 'table', items: summary } } } : {}),
  },
} as unknown as LhrResult);

describe('parseResources — requests', () => {
  it('normalises a network row into the shape the waterfall draws', () => {
    const { requests } = parseResources(lhrWith([{
      url: 'https://a.test/app.js', resourceType: 'Script', transferSize: 12_000, resourceSize: 40_000,
      statusCode: 200, mimeType: 'text/javascript',
      rendererStartTime: 100.4, networkRequestTime: 160.2, networkEndTime: 400.9,
    }]), 'https://a.test/');

    expect(requests[0]).toMatchObject({
      url: 'https://a.test/app.js', resourceType: 'script', transferSize: 12_000,
      isThirdParty: false, startTime: 100, endTime: 401, ttfb: 60, contentDownloadTime: 241,
    });
  });

  it('folds fetch/xhr/websocket into "other" rather than inventing types', () => {
    const { requests } = parseResources(lhrWith([
      { url: 'https://a.test/api', resourceType: 'XHR' },
      { url: 'https://a.test/data', resourceType: 'Fetch' },
      { url: 'https://a.test/live', resourceType: 'WebSocket' },
      { url: 'https://a.test/thing', resourceType: 'SomethingNew' },
    ]), 'https://a.test/');
    expect(requests.map(r => r.resourceType)).toEqual(['other', 'other', 'other', 'other']);
  });

  it('drops a row with no URL instead of parsing a blank one', () => {
    expect(parseResources(lhrWith([{ url: '' } as NetItem]), 'https://a.test/').requests).toEqual([]);
  });

  it('answers with empty structures when the audit is missing', () => {
    // A static-only run has no network log; the panels read this as "nothing to show".
    const parsed = parseResources({ audits: {} } as unknown as LhrResult, 'https://a.test/');
    expect(parsed.requests).toEqual([]);
    expect(parsed.summary.total).toEqual({ requestCount: 0, transferSize: 0, resourceSize: 0 });
  });

  it('never lets a clock skew produce a negative duration', () => {
    const { requests } = parseResources(lhrWith([{
      url: 'https://a.test/a.js', rendererStartTime: 500, networkRequestTime: 400, networkEndTime: 300,
    }]), 'https://a.test/');
    expect(requests[0]?.ttfb).toBe(0);
    expect(requests[0]?.contentDownloadTime).toBe(0);
  });

  it('discards an end time that is obviously not a page-relative timestamp', () => {
    // Some rows carry an absolute epoch-ish value; drawn as-is it stretches the waterfall
    // to a width nothing else fits in.
    const { requests } = parseResources(lhrWith([{ url: 'https://a.test/a.js', networkEndTime: 1_700_000_000_000 }]), 'https://a.test/');
    expect(requests[0]?.endTime).toBe(0);
  });
});

describe('parseResources — third party', () => {
  it('treats www as the same site', () => {
    const { requests } = parseResources(lhrWith([
      { url: 'https://www.a.test/app.js' },
      { url: 'https://cdn.other.test/x.js' },
    ]), 'https://a.test/');
    expect(requests.map(r => r.isThirdParty)).toEqual([false, true]);
  });

  it('collects the third-party subset for the panel that shows it', () => {
    const { thirdPartyRequests } = parseResources(lhrWith([
      { url: 'https://a.test/app.js' },
      { url: 'https://cdn.other.test/x.js' },
    ]), 'https://a.test/');
    expect(thirdPartyRequests.map(r => r.url)).toEqual(['https://cdn.other.test/x.js']);
  });
});

describe('parseResources — isCritical', () => {
  it('flags transfer sizes above the per-type threshold', () => {
    // Thresholds are compared against post-compression weight. The old set (script 500KB,
    // image 1MB) matched nine of 51 stored audits, all dev builds — "critical" had become
    // a dev-build detector rather than a performance signal.
    const { requests } = parseResources(lhrWith([
      { url: 'https://a.test/big.js',   resourceType: 'Script',     transferSize: 120 * KB },
      { url: 'https://a.test/small.js', resourceType: 'Script',     transferSize:  90 * KB },
      { url: 'https://a.test/app.css',  resourceType: 'Stylesheet', transferSize:  80 * KB },
      { url: 'https://a.test/api',      resourceType: 'Fetch',      transferSize:  50 * 1024 * 1024 },
    ]), 'https://a.test/');

    expect(requests.map(r => r.isCritical)).toEqual([true, false, true, false]);
  });

  it('has no threshold for documents or other — a heavy XHR is not this flag\'s business', () => {
    const { requests } = parseResources(lhrWith([
      { url: 'https://a.test/', resourceType: 'Document', transferSize: 10 * 1024 * 1024 },
    ]), 'https://a.test/');
    expect(requests[0]?.isCritical).toBe(false);
  });
});

describe('parseResources — libraries', () => {
  it('names the libraries it recognises, heaviest first, once each', () => {
    const { detectedLibraries } = parseResources(lhrWith([
      { url: 'https://cdn.test/react.production.min.js', resourceType: 'Script', transferSize: 40 * KB },
      { url: 'https://cdn.test/react-dom.production.min.js', resourceType: 'Script', transferSize: 130 * KB },
      { url: 'https://cdn.test/jquery-3.6.0.min.js', resourceType: 'Script', transferSize: 30 * KB },
      { url: 'https://a.test/anonymous.js', resourceType: 'Script', transferSize: 500 * KB },
    ]), 'https://a.test/');

    expect(detectedLibraries.map(l => l.name)).toEqual(['react', 'jquery']);
    // The heavier of two files matching the same library is the one worth showing.
    expect(detectedLibraries[0]).toMatchObject({ url: 'https://cdn.test/react-dom.production.min.js', isCritical: true });
  });

  it('recognises a framework by its build path, not only by a file name', () => {
    const { detectedLibraries } = parseResources(lhrWith([
      { url: 'https://a.test/_next/static/chunks/main.js', resourceType: 'Script', transferSize: KB },
    ]), 'https://a.test/');
    expect(detectedLibraries.map(l => l.name)).toEqual(['next.js']);
  });
});

describe('parseResources — summary', () => {
  it('prefers Lighthouse\'s own resource-summary and ignores its "total" row', () => {
    // The total is recomputed from the buckets either way, so a stale total row cannot make
    // the parts disagree with the whole.
    const { summary } = parseResources(
      lhrWith(
        [{ url: 'https://a.test/app.js', resourceType: 'Script', transferSize: 5 * KB }],
        [
          { resourceType: 'script', requestCount: 4, transferSize: 100 * KB, resourceSize: 300 * KB },
          { resourceType: 'total',  requestCount: 99, transferSize: 999 * KB, resourceSize: 999 * KB },
        ],
      ),
      'https://a.test/',
    );
    expect(summary.script).toEqual({ requestCount: 4, transferSize: 100 * KB, resourceSize: 300 * KB });
    expect(summary.total).toEqual({ requestCount: 4, transferSize: 100 * KB, resourceSize: 300 * KB });
  });

  it('rolls the requests up itself when there is no summary audit', () => {
    const { summary } = parseResources(lhrWith([
      { url: 'https://a.test/a.js', resourceType: 'Script', transferSize: 5 * KB, resourceSize: 10 * KB },
      { url: 'https://a.test/b.js', resourceType: 'Script', transferSize: 3 * KB, resourceSize:  6 * KB },
      { url: 'https://a.test/c.png', resourceType: 'Image', transferSize: 2 * KB, resourceSize:  2 * KB },
    ]), 'https://a.test/');

    expect(summary.script).toEqual({ requestCount: 2, transferSize: 8 * KB, resourceSize: 16 * KB });
    expect(summary.total.requestCount).toBe(3);
    expect(summary.total.transferSize).toBe(10 * KB);
  });
});
