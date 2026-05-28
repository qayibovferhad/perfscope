import cron from 'node-cron';
import { NightlyAuditService } from '../services/nightlyAudit.service.js';

function currentHHMM(): string {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Runs every minute, finds websites whose scheduleTime matches the current HH:MM.
export function registerNightlyCron(): void {
  cron.schedule('* * * * *', () => {
    const time = currentHHMM();
    NightlyAuditService.runAllEnabled(time).catch((err: unknown) => {
      console.error('[NightlyAudit] Unhandled error in cron:', (err as Error).message);
    });
  });

  console.log('[Cron] Scheduled audit running every minute — triggers per website scheduleTime.');
}
