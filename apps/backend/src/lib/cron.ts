import cron from 'node-cron';
import { isDbReady } from '../config/database.js';

/**
 * Register a scheduled job with the two guards every one of ours needs.
 *
 * **Skip while the database is down.** All three jobs read from Mongo and write their
 * result back; with no connection there is nothing to read and nowhere to record it, and
 * a per-minute schedule would otherwise log the same connection error sixty times an hour
 * until it came back.
 *
 * **Never let a rejection escape.** node-cron does not await the callback, so an unhandled
 * rejection from a job would take the process down rather than skip a tick.
 *
 * The three cron modules keep their own files because each has a reason worth writing down
 * — why the digest tolerates a double tick, why field budgets are hourly — and a table of
 * expressions has nowhere to put that.
 */
export function registerCron(
  { expression, tag, announce, run }: {
    expression: string;
    /** Log prefix for failures, e.g. '[Digest]'. */
    tag: string;
    /** One line at startup saying what is now scheduled. */
    announce: string;
    run: () => Promise<unknown>;
  },
): void {
  cron.schedule(expression, () => {
    if (!isDbReady()) return;
    run().catch((err: unknown) =>
      console.error(`${tag} Unhandled error in cron:`, (err as Error).message));
  });

  console.log(`[Cron] ${announce}`);
}
