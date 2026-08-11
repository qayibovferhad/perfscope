import cron from 'node-cron';
import { runDueDigests } from '../services/digest.service.js';

/**
 * Ticks every minute and sends to whoever is due, mirroring the nightly-audit cron.
 * A per-user lastSentAt guard makes a double tick harmless.
 */
export function registerDigestCron(): void {
  cron.schedule('* * * * *', () => {
    runDueDigests().catch((err: unknown) =>
      console.error('[Digest] Unhandled error in cron:', (err as Error).message));
  });

  console.log('[Cron] Weekly digest checker running every minute — sends on each user’s chosen day/time.');
}
