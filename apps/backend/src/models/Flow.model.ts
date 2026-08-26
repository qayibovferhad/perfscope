import { Schema, model, type Types } from 'mongoose';
import type { FlowStep } from '@perfscope/shared';

/**
 * A saved user flow: where to start, and what to do once there.
 *
 * Its own collection rather than a field on `Website`, for two reasons that both come from
 * how it is used. A flow belongs to a *page state* and not to a site — "the checkout with
 * the coupon panel open" is one flow, and a site has several. And a flow is edited on its
 * own schedule: storing it on the Website document would make every step edit a write to
 * the document that also carries budgets, sessions and breach flags.
 *
 * `websiteId` is a link, not ownership: a flow can be created against a URL the account
 * does not track, exactly as an audit can.
 */
const flowStepSchema = new Schema(
  {
    action:   { type: String, required: true },
    selector: { type: String, default: '' },
    value:    { type: String, default: '' },
    name:     { type: String, default: '' },
    /** Default true: a step measured with everything else cannot say which click was slow. */
    measure:  { type: Boolean, default: true },
  },
  { _id: false },
);

const flowSchema = new Schema(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', default: null },
    name:      { type: String, required: true, trim: true },
    url:       { type: String, required: true },
    steps:     { type: [flowStepSchema], default: [] },
    snapshotAtEnd: { type: Boolean, default: true },
    formFactor: { type: String, enum: ['mobile', 'desktop'], default: 'desktop' },
  },
  { timestamps: true },
);

/** The list page reads every flow of an account, newest first. */
flowSchema.index({ userId: 1, updatedAt: -1 });

export interface IFlow {
  _id:       Types.ObjectId;
  userId:    Types.ObjectId;
  websiteId: Types.ObjectId | null;
  name:      string;
  url:       string;
  steps:     FlowStep[];
  snapshotAtEnd: boolean;
  formFactor: 'mobile' | 'desktop';
  createdAt: Date;
  updatedAt: Date;
}

export const Flow = model<IFlow>('Flow', flowSchema);
