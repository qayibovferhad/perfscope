import mongoose, { type Document, Schema } from 'mongoose';

// ─── Nested schemas ───────────────────────────────────────────────────────────

const MetricsSchema = new Schema(
  {
    fcp: { type: Number, required: true },
    lcp: { type: Number, required: true },
    tbt: { type: Number, required: true },
    cls: { type: Number, required: true },
    si:  { type: Number, required: true },
    tti: { type: Number, required: true },
  },
  { _id: false },
);

const ScoresSchema = new Schema(
  {
    performance:   { type: Number, required: true },
    accessibility: { type: Number, required: true },
    bestPractices: { type: Number, required: true },
    seo:           { type: Number, required: true },
  },
  { _id: false },
);

// ─── Main schema ──────────────────────────────────────────────────────────────

export interface IHistory extends Document {
  analysisId:    string;
  shortId:       string;
  url:           string;
  normalizedUrl: string;
  userId?:       string;
  scores:        { performance: number; accessibility: number; bestPractices: number; seo: number };
  metrics:       { fcp: number; lcp: number; tbt: number; cls: number; si: number; tti: number };
  createdAt:     Date;
}

const HistorySchema = new Schema<IHistory>(
  {
    analysisId:    { type: String, required: true },
    shortId:       { type: String, required: true },
    url:           { type: String, required: true },
    normalizedUrl: { type: String, required: true, index: true },
    userId:        { type: String, index: true },
    scores:        { type: ScoresSchema, required: true },
    metrics:       { type: MetricsSchema, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const HistoryModel = mongoose.model<IHistory>('History', HistorySchema);
