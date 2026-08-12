/**
 * Relative timestamps, shared because several features print them.
 *
 * Coarse on purpose: "3h ago" is what a reader wants from an audit list. A precise
 * timestamp belongs on the detail view, where the exact minute can matter.
 */
export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 60) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// Short dates, shared for the same reason as timeAgo — ten local copies had already
// split between UTC and local rendering, so the same audit could print as two
// different days. Everything user-facing renders in the user's own timezone.

/** "Aug 12" — for full timestamps; renders in the viewer's timezone. */
export function fmtDay(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * "Aug 12" — for `YYYY-MM-DD` bucket keys (chart axes). A day key names a calendar
 * day, not an instant: rendering it through the viewer's timezone would shift it to
 * the previous day west of UTC, so it is pinned instead.
 */
export function fmtDayKey(key: string): string {
  return new Date(`${key}T00:00:00Z`)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "Aug 12, 2026 14:05" — detail views where the exact run matters. */
export function fmtDateTime(iso: string | number | Date): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
}
