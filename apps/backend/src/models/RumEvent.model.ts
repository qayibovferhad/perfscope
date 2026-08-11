import { Schema, model, type Types } from 'mongoose';

/**
 * One real page view's Core Web Vitals.
 *
 * Stored raw rather than pre-aggregated: percentiles cannot be derived from summaries,
 * and p75 is the whole point of field data. Volume is bounded by a TTL index instead —
 * old samples expire, and anything older than the retention window was never going to
 * be queried.
 *
 * Carries no identifiers. Path only (the collector drops query and fragment before
 * sending), coarse device class, no IP, no cookies, nothing that identifies a visitor.
 */

/** Raw samples are dropped after this long. Long enough for a month-over-month read. */
const RETENTION_DAYS = 45;

const rumEventSchema = new Schema(
  {
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true },
    /** Path only — never a full URL. */
    path:      { type: String, required: true },
    device:    { type: String, enum: ['mobile', 'desktop'], required: true },

    // Every metric is optional: a visitor who leaves during load reports what it had.
    lcp:  { type: Number, default: null },
    inp:  { type: Number, default: null },
    cls:  { type: Number, default: null },
    fcp:  { type: Number, default: null },
    ttfb: { type: Number, default: null },

    /** Collector version that produced this row. */
    v: { type: Number, default: 1 },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// The aggregation always filters by site and window, and often by device.
rumEventSchema.index({ websiteId: 1, createdAt: -1 });
rumEventSchema.index({ websiteId: 1, path: 1, createdAt: -1 });
// Mongo drops expired documents on its own — no cleanup job to forget about.
rumEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

export interface IRumEvent {
  _id:       Types.ObjectId;
  websiteId: Types.ObjectId;
  path:      string;
  device:    'mobile' | 'desktop';
  lcp:  number | null;
  inp:  number | null;
  cls:  number | null;
  fcp:  number | null;
  ttfb: number | null;
  v:         number;
  createdAt: Date;
}

export const RumEvent = model<IRumEvent>('RumEvent', rumEventSchema);
