/**
 * Shared by both network waterfalls — the timeline one that renders beside the filmstrip,
 * and the plain one that stands in when there is no trace to draw a filmstrip from.
 *
 * They are alternates, never on screen together, so they stay two components. What they
 * must not do is answer the same question differently.
 */

/** Rows drawn at most — past this the chart is unreadable and the DOM is the bottleneck. */
export const MAX_ROWS = 120;

/** Vertical gridlines; an axis draws TICK_COUNT + 1 labels. */
export const TICK_COUNT = 6;

/** Last path segment, falling back to the host for a bare origin. */
export function resourceFilename(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.at(-1) || u.hostname;
  } catch {
    return url.split('/').pop() || url;
  }
}
