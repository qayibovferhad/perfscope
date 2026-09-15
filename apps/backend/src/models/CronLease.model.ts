import { Schema, model } from 'mongoose';

/**
 * One scheduled tick, claimed by whichever backend instance got there first.
 *
 * Every instance runs the same crons, so behind more than one of them each tick fired once
 * per process: the same nightly routes audited twice against each other (which reports
 * *worse* numbers, not just duplicate rows), the same digest mailed twice. The `_id` is the
 * job and its time bucket, and a unique `_id` is the one lock Mongo gives for free — the
 * losing insert fails with 11000 and that instance skips the tick.
 *
 * Nothing reads these back. The TTL index is housekeeping: a key names its own minute (or
 * hour), so an old one can never be claimed again and only has to go away eventually.
 */
const cronLeaseSchema = new Schema(
  {
    _id:       { type: String, required: true },
    /** Which process won — for someone reading the collection during an incident. */
    holder:    { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

cronLeaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface ICronLease {
  _id:       string;
  holder:    string;
  expiresAt: Date;
}

export const CronLease = model<ICronLease>('CronLease', cronLeaseSchema);
