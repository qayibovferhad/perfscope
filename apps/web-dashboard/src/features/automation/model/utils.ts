import { nextRunDate, type WebsiteAutomation } from '@perfscope/shared';

export function fmtDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * When this site is next audited.
 *
 * Delegates to the shared `nextRunDate` so the card, the modal preview and the cron all
 * read one timetable — with slots and spread there is no single "scheduleTime" to project
 * forward, and computing it here again would drift from what actually runs.
 */
export function nextRunAt(automation: Partial<WebsiteAutomation> | null | undefined): string {
  const next = nextRunDate(automation);
  if (!next) return 'Not scheduled';
  return next.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
