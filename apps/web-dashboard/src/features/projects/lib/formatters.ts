// Lives in shared/lib now that the dashboard prints relative times too; re-exported
// so this module stays the one place the projects feature imports formatting from.
import { timeAgo } from '@/shared/lib/time';
import { fmtDay } from '@/shared/lib/time';
export { timeAgo };

export function formatAuditDate(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const prev = new Date(now);
  prev.setDate(now.getDate() - 1);
  const prefix =
    d.toDateString() === now.toDateString()  ? 'Today' :
    d.toDateString() === prev.toDateString() ? 'Yesterday' :
    fmtDay(iso);
  return `${prefix} · ${timeAgo(iso)}`;
}

