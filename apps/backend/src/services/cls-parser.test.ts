import { describe, it, expect } from 'vitest';
import type { RunnerResult } from 'lighthouse';
import { parseCLSData } from './cls-parser.js';

interface ShiftRow {
  node?: { selector?: string; snippet?: string; boundingRect?: Record<string, number> };
  score?: number;
  subItems?: { items: Array<{ cause?: { value?: string } }> };
}

const lhrWith = (
  { cls = 0.25, items, auditId = 'layout-shifts', emulation }:
  { cls?: number; items?: ShiftRow[]; auditId?: string; emulation?: { width: number; height: number } },
): RunnerResult['lhr'] => ({
  audits: {
    'cumulative-layout-shift': { numericValue: cls },
    ...(items ? { [auditId]: { details: { type: 'table', items } } } : {}),
  },
  ...(emulation ? { configSettings: { screenEmulation: emulation } } : {}),
} as unknown as RunnerResult['lhr']);

const shift = (over: ShiftRow = {}): ShiftRow =>
  ({ node: { selector: 'main > div.banner', snippet: '<div class="banner">' }, score: 0.08, ...over });

describe('parseCLSData', () => {
  it('reports the shifting elements with their impact band', () => {
    const data = parseCLSData(lhrWith({ items: [
      shift({ score: 0.08 }),
      shift({ score: 0.02 }),
      shift({ score: 0.001 }),
    ] }));

    expect(data?.totalScore).toBe(0.25);
    expect(data?.elements.map(e => e.impact)).toEqual(['high', 'medium', 'low']);
  });

  it('reads the older audit id too', () => {
    // v12 renamed `layout-shift-elements` to `layout-shifts`; a stored artifact may predate
    // the upgrade.
    expect(parseCLSData(lhrWith({ items: [shift()], auditId: 'layout-shift-elements' }))?.elements).toHaveLength(1);
  });

  it('is null for a page that did not shift', () => {
    // Below 0.001 there is nothing to visualise, and drawing an empty viewport with a
    // "layout shift" heading reads as a broken panel.
    expect(parseCLSData(lhrWith({ cls: 0, items: [shift()] }))).toBeNull();
    expect(parseCLSData(lhrWith({ cls: 0.0005, items: [shift()] }))).toBeNull();
  });

  it('is null when there is no shift table, or nothing in it has an element', () => {
    expect(parseCLSData(lhrWith({}))).toBeNull();
    expect(parseCLSData(lhrWith({ items: [] }))).toBeNull();
    // Some shift events have no identified DOM node — a rectangle with no selector cannot
    // be pointed at.
    expect(parseCLSData(lhrWith({ items: [{ score: 0.1 }] }))).toBeNull();
  });

  it('converts the bounding rect to viewport-relative fractions', () => {
    const data = parseCLSData(lhrWith({
      emulation: { width: 400, height: 800 },
      items: [shift({ node: { selector: '#hero', boundingRect: { top: 80, left: 100, width: 200, height: 400 } } })],
    }));

    expect(data?.viewportWidth).toBe(400);
    expect(data?.elements[0]?.rect).toEqual({ topPct: 0.1, leftPct: 0.25, widthPct: 0.5, heightPct: 0.5 });
  });

  it('clamps an element that hangs outside the viewport', () => {
    const data = parseCLSData(lhrWith({
      emulation: { width: 400, height: 800 },
      items: [shift({ node: { selector: '#wide', boundingRect: { top: -50, left: 0, width: 900, height: 1600 } } })],
    }));
    expect(data?.elements[0]?.rect).toEqual({ topPct: 0, leftPct: 0, widthPct: 1, heightPct: 1 });
  });

  it('falls back to the Puppeteer default viewport when the LHR does not say', () => {
    const data = parseCLSData(lhrWith({ items: [shift()] }));
    expect([data?.viewportWidth, data?.viewportHeight]).toEqual([800, 600]);
  });

  it('classifies the root cause Lighthouse names, and stays quiet otherwise', () => {
    const cause = (value: string) => parseCLSData(lhrWith({
      items: [shift({ subItems: { items: [{ cause: { value } }] } })],
    }))?.elements[0]?.rootCause;

    expect(cause('Media element lacking an explicit size')).toBe('unsized-media');
    expect(cause('Web font loaded')).toBe('web-font');
    expect(cause('Injected iframe')).toBe('injected-iframe');
    expect(cause('Something new Lighthouse started reporting')).toBeUndefined();
  });
});
