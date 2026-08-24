import { describe, it, expect } from 'vitest';
import type { RunnerResult } from 'lighthouse';
import type { NetworkRequest } from '@perfscope/shared';
import { parseThirdParties } from './third-party-parser.js';

const KB = 1024;

const lhrWith = (items?: unknown[]): RunnerResult['lhr'] =>
  ({ audits: items ? { 'third-party-summary': { details: { type: 'table', items } } } : {} } as unknown as RunnerResult['lhr']);

const request = (over: Partial<NetworkRequest> = {}): NetworkRequest => ({
  url: 'https://cdn.other.test/x.js', resourceType: 'script', transferSize: 10 * KB, resourceSize: 10 * KB,
  statusCode: 200, mimeType: 'text/javascript', isThirdParty: true, detectedLibrary: null,
  isCritical: false, startTime: 0, endTime: 0, ttfb: 0, contentDownloadTime: 0, ...over,
});

describe('parseThirdParties — from Lighthouse\'s own audit', () => {
  it('reads blocking and main-thread time, which the network log cannot give', () => {
    const entities = parseThirdParties(lhrWith([{
      entity: 'Google Tag Manager', transferSize: 90 * KB, mainThreadTime: 420, blockingTime: 180,
      subItems: { items: [{}, {}, {}] },
    }]));
    expect(entities).toEqual([{
      name: 'Google Tag Manager', transferSize: 90 * KB, mainThreadTime: 420, blockingTime: 180, requestCount: 3,
    }]);
  });

  it('accepts both the v12 string entity and the older link cell', () => {
    const entities = parseThirdParties(lhrWith([
      { entity: 'Plain String', transferSize: 5 * KB },
      { entity: { type: 'link', text: 'Link Cell' }, transferSize: 5 * KB },
      { entity: { name: 'Name Cell' }, transferSize: 5 * KB },
      { transferSize: 5 * KB },                             // no entity at all — skipped
    ]));
    expect(entities?.map(e => e.name)).toEqual(['Plain String', 'Link Cell', 'Name Cell']);
  });

  it('ranks by blocking time, then bytes', () => {
    const entities = parseThirdParties(lhrWith([
      { entity: 'Light',   transferSize: 200 * KB, blockingTime: 0 },
      { entity: 'Blocker', transferSize:  10 * KB, blockingTime: 300 },
      { entity: 'Heavy',   transferSize: 400 * KB, blockingTime: 0 },
    ]));
    expect(entities?.map(e => e.name)).toEqual(['Blocker', 'Heavy', 'Light']);
  });

  it('drops sub-kilobyte vendors that block nothing, but keeps a tiny one that does', () => {
    // A pixel that costs a kilobyte and no time is noise in a table someone has to read;
    // one that blocks the main thread is a finding at any size.
    const entities = parseThirdParties(lhrWith([
      { entity: 'Noise', transferSize: 300, blockingTime: 0 },
      { entity: 'Tiny blocker', transferSize: 200, blockingTime: 90 },
    ]));
    expect(entities?.map(e => e.name)).toEqual(['Tiny blocker']);
  });

  it('shows at most twelve vendors', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ entity: `V${i}`, transferSize: (i + 1) * KB }));
    expect(parseThirdParties(lhrWith(items))).toHaveLength(12);
  });

  it('reads a missing numeric field as zero rather than NaN', () => {
    const [entity] = parseThirdParties(lhrWith([{ entity: 'X', transferSize: 5 * KB }])) ?? [];
    expect(entity).toMatchObject({ mainThreadTime: 0, blockingTime: 0, requestCount: 0 });
  });
});

describe('parseThirdParties — fallback to the network log', () => {
  it('rolls third-party requests up by host when the audit did not run', () => {
    // The static group has no third-party-summary; the panel still says something true,
    // just less — bytes and counts, no timing.
    const entities = parseThirdParties(lhrWith(), [
      request({ url: 'https://cdn.other.test/a.js', transferSize: 30 * KB }),
      request({ url: 'https://cdn.other.test/b.js', transferSize: 20 * KB }),
      request({ url: 'https://a.test/own.js', transferSize: 90 * KB, isThirdParty: false }),
    ]);
    expect(entities).toEqual([
      { name: 'cdn.other.test', transferSize: 50 * KB, mainThreadTime: 0, blockingTime: 0, requestCount: 2 },
    ]);
  });

  it('falls back when the audit ran but reported nothing usable', () => {
    const entities = parseThirdParties(lhrWith([]), [request({ transferSize: 40 * KB })]);
    expect(entities?.[0]?.name).toBe('cdn.other.test');
  });

  it('is null — not an empty list — when there is nothing to report', () => {
    // The panel branches on presence, so "no vendors" and "we did not look" must not both
    // render as an empty table.
    expect(parseThirdParties(lhrWith(), [])).toBeNull();
    expect(parseThirdParties(lhrWith(), [request({ isThirdParty: false })])).toBeNull();
  });
});
