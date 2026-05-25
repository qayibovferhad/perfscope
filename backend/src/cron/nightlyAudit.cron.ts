import cron from 'node-cron';
import { NightlyAuditService } from '../services/nightlyAudit.service.js';

// Fires every day at midnight (00:00 server time).
const SCHEDULE = '0 0 * * *';

export function registerNightlyCron(): void {
  cron.schedule(SCHEDULE, () => {
    NightlyAuditService.runAllEnabled().catch((err: unknown) => {
      console.error('[NightlyAudit] Unhandled error in cron:', (err as Error).message);
    });
  });

  console.log('[Cron] Nightly audit scheduled — runs daily at 00:00.');
}
