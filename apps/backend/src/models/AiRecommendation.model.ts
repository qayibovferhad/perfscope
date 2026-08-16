import mongoose, { type Document, Schema } from 'mongoose';

/**
 * One fix `analysePage` has given for one page, tracked across audits so the model can
 * see what it already told this user rather than starting from zero every run.
 *
 * `fingerprint` is what makes two differently-worded fixes the "same" recommendation —
 * see `fingerprintFix` in `aiRecommendation.service.ts`. `resolvedAt` is set the first
 * audit whose fixes no longer carry a fingerprint that used to appear here; it is cleared
 * again if that fingerprint comes back (the fix regressed, not a one-off).
 */
export interface IAiRecommendation extends Document {
  userId:      string;
  url:         string;
  fingerprint: string;
  /** Most recent wording — what to show back to the user ("you said X"). */
  fixText:     string;
  /**
   * The identifiers `fingerprint` was built from (see `fingerprintFix`), kept in the
   * clear so a later audit can check whether they still show up ANYWHERE on the page —
   * not just whether this fix made the current run's short headline list. Dropping out
   * of the top 3-6 fixes on one run does not mean an audit passed.
   */
  identifiers: string[];
  firstSeenAt: Date;
  lastSeenAt:  Date;
  timesGiven:  number;
  resolvedAt:  Date | null;
}

const AiRecommendationSchema = new Schema<IAiRecommendation>({
  userId:      { type: String, required: true },
  url:         { type: String, required: true },
  fingerprint: { type: String, required: true },
  fixText:     { type: String, required: true },
  identifiers: { type: [String], default: [] },
  firstSeenAt: { type: Date, required: true },
  lastSeenAt:  { type: Date, required: true },
  timesGiven:  { type: Number, required: true, default: 1 },
  resolvedAt:  { type: Date, default: null },
});

// One row per (user, page, recommendation); every read and write goes through this triple.
AiRecommendationSchema.index({ userId: 1, url: 1, fingerprint: 1 }, { unique: true });

export const AiRecommendationModel =
  mongoose.model<IAiRecommendation>('AiRecommendation', AiRecommendationSchema);
