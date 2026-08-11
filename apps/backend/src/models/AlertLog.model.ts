import { Schema, model, type Types } from 'mongoose';

/**
 * Every alert the backend decided to send, and where it went.
 *
 * Two jobs. It answers "why didn't I get an alert?" — otherwise unanswerable, since
 * delivery is fire-and-forget. And it is the state a budget breach is judged against:
 * an open entry means the site is already known to be broken, so the next audit stays
 * quiet instead of repeating itself every night.
 */

const deliverySchema = new Schema(
  {
    channel: { type: String, enum: ['webhook', 'email'], required: true },
    ok:      { type: Boolean, required: true },
    error:   { type: String, default: null },
  },
  { _id: false },
);

const alertLogSchema = new Schema(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true, index: true },
    /** The audited page, not the site root — alerts are per-URL. */
    url:       { type: String, required: true },
    /** 'budget.breach' | 'budget.recovered' | 'audit.regression' */
    event:     { type: String, required: true },
    /** 'firing' opens an incident; 'recovered' closes it; 'event' is point-in-time. */
    status:    { type: String, enum: ['firing', 'recovered', 'event'], required: true },
    /** Which metrics tripped, e.g. ['lcp', 'performance']. */
    metrics:   { type: [String], default: [] },
    analysisId: { type: String, default: null },
    /** Human-readable bullets, exactly as sent. */
    lines:     { type: [String], default: [] },
    delivery:  { type: [deliverySchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The dedup lookup: newest entry for a given page + event.
alertLogSchema.index({ websiteId: 1, url: 1, event: 1, createdAt: -1 });

export interface IAlertDelivery {
  channel: 'webhook' | 'email';
  ok:      boolean;
  error:   string | null;
}

export interface IAlertLog {
  _id:        Types.ObjectId;
  userId:     Types.ObjectId;
  websiteId:  Types.ObjectId;
  url:        string;
  event:      string;
  status:     'firing' | 'recovered' | 'event';
  metrics:    string[];
  analysisId: string | null;
  lines:      string[];
  delivery:   IAlertDelivery[];
  createdAt:  Date;
}

export const AlertLog = model<IAlertLog>('AlertLog', alertLogSchema);
