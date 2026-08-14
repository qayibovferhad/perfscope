import { runDueDigests } from '../services/digest.service.js';
import { registerCron } from '../lib/cron.js';

/**
 * Ticks every minute and sends to whoever is due, mirroring the nightly-audit cron.
 * A per-user lastSentAt guard makes a double tick harmless.
 */
export function registerDigestCron(): void {
  registerCron({
    expression: '* * * * *',
    tag:        '[Digest]',
    announce:   'Weekly digest checker running every minute — sends on each user’s chosen day/time.',
    run:        runDueDigests,
  });
}
