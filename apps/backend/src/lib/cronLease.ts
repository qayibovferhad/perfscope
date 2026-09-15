import { hostname } from 'node:os';
import { CronLease } from '../models/CronLease.model.js';

/** Identifies this process in a lease; host alone is not enough for two on one machine. */
const HOLDER = `${hostname()}:${process.pid}`;

/**
 * The bucket a tick belongs to, **rounded to the nearest** period rather than floored.
 *
 * Two instances fire "the same" tick at their own idea of :00, and clocks disagree by
 * milliseconds to seconds. Flooring puts a tick at 11:59:59.8 and one at 12:00:00.1 in
 * different minutes, so both would win; rounding puts both in 12:00 as long as the skew
 * stays under half a period — thirty seconds for the per-minute jobs, which NTP does not
 * come near.
 */
export function tickBucket(now: number, periodMs: number): number {
  return Math.round(now / periodMs) * periodMs;
}

export function leaseKey(job: string, now: number, periodMs: number): string {
  return `${job}@${new Date(tickBucket(now, periodMs)).toISOString()}`;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

/**
 * Claim this tick of `job` for this process. `true` means run it; `false` means another
 * instance already has. Any other failure is thrown — a database that cannot take an insert
 * cannot take the job's own writes either, and the caller already logs a rejected run.
 */
export async function claimTick(job: string, periodMs: number, now = Date.now()): Promise<boolean> {
  try {
    await CronLease.create({
      _id:       leaseKey(job, now, periodMs),
      holder:    HOLDER,
      // Two periods: long past the tick, and the TTL monitor only sweeps once a minute anyway.
      expiresAt: new Date(tickBucket(now, periodMs) + 2 * periodMs),
    });
    return true;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}
