import mongoose, { type Document, Schema } from 'mongoose';

const MetricsSchema = new Schema(
  { fcp: Number, lcp: Number, tbt: Number, cls: Number, si: Number, tti: Number },
  { _id: false },
);
const ScoresSchema = new Schema(
  { performance: Number, accessibility: Number, bestPractices: Number, seo: Number },
  { _id: false },
);
const SideSchema = new Schema({ scores: ScoresSchema, metrics: MetricsSchema }, { _id: false });

export interface ICompareHistory extends Document {
  /** Owner. Stored as a string of the user's ObjectId, like History does. */
  userId:         string;
  pairId:         string;
  sourceUrl:      string;
  targetUrl:      string;
  sourceHostname: string;
  targetHostname: string;
  source:         { scores: Record<string, number>; metrics: Record<string, number> };
  competitor:     { scores: Record<string, number>; metrics: Record<string, number> };
  winner:         'source' | 'competitor' | 'tie';
  /** Gemini's read on the matchup, written once when the comparison is saved. */
  aiVerdict?:     string;
  createdAt:      Date;
}

const CompareHistorySchema = new Schema<ICompareHistory>(
  {
    // Every query in the service filters on this. It was missing entirely, so one
    // account's comparisons were listed for every other account.
    userId:         { type: String, required: true, index: true },
    pairId:         { type: String, required: true, index: true },
    sourceUrl:      { type: String, required: true },
    targetUrl:      { type: String, required: true },
    sourceHostname: { type: String, required: true },
    targetHostname: { type: String, required: true },
    source:         { type: SideSchema, required: true },
    competitor:     { type: SideSchema, required: true },
    winner:         { type: String, enum: ['source', 'competitor', 'tie'], required: true },
    // Stored rather than regenerated per view: the numbers it describes never change, so a
    // second opinion on the same pair would only be a second bill.
    aiVerdict:      { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The shape every read uses: this user's runs for this pair, newest first.
CompareHistorySchema.index({ userId: 1, pairId: 1, createdAt: -1 });

export const CompareHistoryModel = mongoose.model<ICompareHistory>('CompareHistory', CompareHistorySchema);
