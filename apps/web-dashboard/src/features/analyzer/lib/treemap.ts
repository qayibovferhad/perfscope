/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 2000).
 *
 * Pure geometry, no React and no SVG: given weighted items and a box, it answers where each
 * rectangle goes. Written here rather than taken from a chart library because the analyzer's
 * other visualisations (flame chart, CLS, waterfall) are hand-drawn SVG for the same reason —
 * each needs one thing a generic component will not do, and here it is the unused-bytes
 * overlay drawn *inside* every tile.
 *
 * "Squarified" is the part that matters to a reader: naive slice-and-dice gives long thin
 * slivers whose areas are impossible to compare and whose labels do not fit. This keeps
 * rectangles near square, so relative size is readable at a glance.
 */

export interface TreemapItem {
  /** Relative area. Zero or negative weights are dropped — they have no area to occupy. */
  value: number
}

export interface TreemapRect {
  /** Index into the input array. */
  index:  number
  x:      number
  y:      number
  width:  number
  height: number
}

interface Box { x: number; y: number; width: number; height: number }

/** How far from square a row's worst tile is; lower is better, 1 is a perfect square. */
function worstRatio(rowValues: number[], rowSum: number, side: number, scale: number): number {
  if (rowSum <= 0 || side <= 0) return Infinity;
  const area = rowSum * scale;
  const thickness = area / side;
  let worst = 1;
  for (const value of rowValues) {
    const length = (value * scale) / thickness;
    worst = Math.max(worst, Math.max(thickness / length, length / thickness));
  }
  return worst;
}

/**
 * Lay `items` out inside `box`, areas proportional to `value`.
 *
 * Rectangles are returned in input order's *sorted* sequence — biggest first — each
 * carrying the index it came from, so a caller can keep its own array untouched.
 */
export function squarify(items: TreemapItem[], box: Box): TreemapRect[] {
  const entries = items
    .map((item, index) => ({ index, value: item.value }))
    .filter(e => e.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = entries.reduce((sum, e) => sum + e.value, 0);
  if (total <= 0 || box.width <= 0 || box.height <= 0) return [];

  const out: TreemapRect[] = [];
  const scale = (box.width * box.height) / total;

  let free: Box = { ...box };
  let i = 0;

  while (i < entries.length) {
    const side = Math.min(free.width, free.height);
    const row: typeof entries = [];
    let rowSum = 0;

    // Grow the row while doing so makes its worst rectangle *more* square.
    while (i < entries.length) {
      const next = entries[i]!;
      const current = worstRatio(row.map(e => e.value), rowSum, side, scale);
      const candidate = worstRatio([...row.map(e => e.value), next.value], rowSum + next.value, side, scale);
      if (row.length > 0 && candidate > current) break;
      row.push(next);
      rowSum += next.value;
      i++;
    }

    // Lay the row along the shorter side, which is what keeps the tiles square.
    const thickness = (rowSum * scale) / Math.max(side, 1e-9);
    const horizontal = free.width >= free.height;
    let offset = horizontal ? free.y : free.x;

    for (const entry of row) {
      const length = (entry.value * scale) / Math.max(thickness, 1e-9);
      out.push(horizontal
        ? { index: entry.index, x: free.x, y: offset, width: thickness, height: length }
        : { index: entry.index, x: offset, y: free.y, width: length, height: thickness });
      offset += length;
    }

    free = horizontal
      ? { x: free.x + thickness, y: free.y, width: Math.max(0, free.width - thickness), height: free.height }
      : { x: free.x, y: free.y + thickness, width: free.width, height: Math.max(0, free.height - thickness) };

    if (free.width <= 0 || free.height <= 0) break;
  }

  return out;
}
