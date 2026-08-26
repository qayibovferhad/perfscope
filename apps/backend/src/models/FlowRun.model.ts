import { Schema, model, type Types } from 'mongoose';
import type { FlowStepResult } from '@perfscope/shared';

/**
 * One execution of a flow.
 *
 * Deliberately **not** stored in `History`. Everything downstream of that collection assumes
 * a navigation audit: `hasResult` reads four category scores, budgets compare against
 * thresholds that only a cold load produces, `getPreviousRun` matches on form factor and
 * URL, and the dashboard averages `scores.performance` across it. A timespan step has no
 * LCP and a snapshot has no timing at all — filing those next to navigations would quietly
 * drag every average and every trend line sideways.
 *
 * So flows keep their own history, and nothing else reads it.
 */
const flowRunSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    flowId: { type: Schema.Types.ObjectId, ref: 'Flow', required: true, index: true },
    name:   { type: String, required: true },
    url:    { type: String, required: true },
    formFactor: { type: String, enum: ['mobile', 'desktop'], default: 'desktop' },
    /** The whole per-step report, as the client renders it — see FlowStepResult. */
    steps:  { type: Schema.Types.Mixed, default: [] },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/** A flow's own history, newest first — the only way these are ever read. */
flowRunSchema.index({ flowId: 1, createdAt: -1 });

export interface IFlowRun {
  _id:    Types.ObjectId;
  userId: Types.ObjectId;
  flowId: Types.ObjectId;
  name:   string;
  url:    string;
  formFactor: 'mobile' | 'desktop';
  steps:  FlowStepResult[];
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export const FlowRun = model<IFlowRun>('FlowRun', flowRunSchema);
