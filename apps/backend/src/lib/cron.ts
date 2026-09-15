import cron from 'node-cron';
import { isDbReady } from '../config/database.js';
import { log } from './logger.js';
import { claimTick } from './cronLease.js';

export const MINUTE_MS = 60_000;
export const HOUR_MS   = 60 * MINUTE_MS;

/**
 * Register a scheduled job with the three guards every one of ours needs.
 *
 * **Skip while the database is down.** All three jobs read from Mongo and write their
 * result back; with no connection there is nothing to read and nowhere to record it, and
 * a per-minute schedule would otherwise log the same connection error sixty times an hour
 * until it came back.
 *
 * **Run each tick once across instances.** Every backend process schedules the same jobs;
 * without a claim, two instances audit the same routes at the same minute — competing for
 * CPU, which reports worse numbers — and mail the same digest twice. `claimTick` inserts a
 * key naming the job and its bucket, and only the instance whose insert lands runs it. On
 * a single instance that is one extra insert per tick.
 *
 * **Never let a rejection escape.** node-cron does not await the callback, so an unhandled
 * rejection from a job would take the process down rather than skip a tick.
 *
 * The three cron modules keep their own files because each has a reason worth writing down
 * — why the digest tolerates a double tick, why field budgets are hourly — and a table of
 * expressions has nowhere to put that.
 */
export function registerCron(
  { expression, tag, announce, periodMs, run }: {
    expression: string;
    /** Log scope for failures, e.g. 'Digest' — the logger adds the brackets. */
    tag: string;
    /** One line at startup saying what is now scheduled. */
    announce: string;
    /**
     * How often the expression fires — the bucket a tick is claimed in. It has to match the
     * expression: a shorter period would let a second instance claim the same tick under a
     * neighbouring key.
     */
    periodMs: number;
    run: () => Promise<unknown>;
  },
): void {
  cron.schedule(expression, () => {
    if (!isDbReady()) return;
    claimTick(tag, periodMs)
      .then(won => (won ? run() : undefined))
      .catch((err: unknown) => log.error(tag, 'unhandled error in cron', { err }));
  });

  log.info('Cron', announce);
}
