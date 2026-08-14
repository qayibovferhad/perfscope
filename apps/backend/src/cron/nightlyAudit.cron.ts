import { NightlyAuditService } from '../services/nightlyAudit.service.js';
import { registerCron } from '../lib/cron.js';

function currentHHMM(): string {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Runs every minute, finds websites whose scheduleTime matches the current HH:MM.
export function registerNightlyCron(): void {
  registerCron({
    expression: '* * * * *',
    tag:        '[NightlyAudit]',
    announce:   'Scheduled audit running every minute — triggers per website scheduleTime.',
    run:        () => NightlyAuditService.runAllEnabled(currentHHMM()),
  });
}
