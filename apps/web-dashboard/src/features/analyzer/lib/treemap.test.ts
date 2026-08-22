import { describe, it, expect } from 'vitest';
import { squarify } from './treemap';

const BOX = { x: 0, y: 0, width: 400, height: 300 };
const area = (r: { width: number; height: number }) => r.width * r.height;

function overlaps(a: { x: number; y: number; width: number; height: number },
                  b: { x: number; y: number; width: number; height: number }): boolean {
  // A shared edge is not an overlap; a shared *area* is.
  return a.x < b.x + b.width - 0.01 && b.x < a.x + a.width - 0.01
      && a.y < b.y + b.height - 0.01 && b.y < a.y + a.height - 0.01;
}

describe('squarify', () => {
  it('fills the box exactly — the map has to account for the whole bundle', () => {
    const rects = squarify([{ value: 50 }, { value: 30 }, { value: 20 }], BOX);
    const total = rects.reduce((sum, r) => sum + area(r), 0);
    expect(total).toBeCloseTo(BOX.width * BOX.height, 1);
  });

  it('gives each item area in proportion to its value', () => {
    const rects = squarify([{ value: 75 }, { value: 25 }], BOX);
    const big = rects.find(r => r.index === 0)!;
    const small = rects.find(r => r.index === 1)!;
    expect(area(big) / area(small)).toBeCloseTo(3, 1);
  });

  it('never overlaps two tiles', () => {
    const rects = squarify(
      [40, 25, 15, 10, 5, 3, 2].map(value => ({ value })),
      BOX,
    );
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });

  it('keeps every tile inside the box', () => {
    const rects = squarify([9, 7, 5, 4, 3, 1].map(value => ({ value })), { x: 10, y: 20, width: 200, height: 120 });
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(10 - 0.01);
      expect(r.y).toBeGreaterThanOrEqual(20 - 0.01);
      expect(r.x + r.width).toBeLessThanOrEqual(210 + 0.01);
      expect(r.y + r.height).toBeLessThanOrEqual(140 + 0.01);
    }
  });

  it('returns the biggest first, each carrying the index it came from', () => {
    const rects = squarify([{ value: 1 }, { value: 100 }, { value: 10 }], BOX);
    expect(rects.map(r => r.index)).toEqual([1, 2, 0]);
  });

  it('produces rectangles closer to square than slice-and-dice would', () => {
    // Ten equal items in a 400×300 box: naive slicing gives 40×300 slivers (ratio 7.5).
    const rects = squarify(Array.from({ length: 10 }, () => ({ value: 1 })), BOX);
    const worst = Math.max(...rects.map(r => Math.max(r.width / r.height, r.height / r.width)));
    expect(worst).toBeLessThan(2.5);
  });

  it('drops zero and negative weights instead of drawing nothing-sized tiles', () => {
    const rects = squarify([{ value: 10 }, { value: 0 }, { value: -5 }], BOX);
    expect(rects.map(r => r.index)).toEqual([0]);
  });

  it('is empty for an empty input or a zero-sized box', () => {
    expect(squarify([], BOX)).toEqual([]);
    expect(squarify([{ value: 1 }], { x: 0, y: 0, width: 0, height: 100 })).toEqual([]);
  });
});
