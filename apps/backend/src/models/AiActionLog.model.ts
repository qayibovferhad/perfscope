import mongoose, { type Document, Schema } from 'mongoose';
import type { AiAdviceAction } from '@perfscope/shared';

/**
 * One click on an advisor action link. The advisor tells the user to do something; this
 * is how a later call finds out whether they did, and what happened after — see
 * `getActionOutcome` in `adviceAction.service.ts`.
 */
export interface IAiActionLog extends Document {
  userId:  string;
  kind:    AiAdviceAction['kind'];
  url:     string;
  actedAt: Date;
}

const AiActionLogSchema = new Schema<IAiActionLog>({
  userId:  { type: String, required: true },
  kind:    { type: String, enum: ['audit', 'schedule', 'compare', 'budgets'], required: true },
  url:     { type: String, required: true },
  actedAt: { type: Date, required: true },
});

// The one read this collection serves: the most recent click for a page, newest first.
AiActionLogSchema.index({ userId: 1, url: 1, actedAt: -1 });

export const AiActionLogModel = mongoose.model<IAiActionLog>('AiActionLog', AiActionLogSchema);
