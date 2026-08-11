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
  return `${Math.floor(h / 24)}d ago`;
}
