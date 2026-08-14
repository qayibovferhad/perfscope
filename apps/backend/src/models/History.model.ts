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
  routePath:     string;
  userId?:       string;
  projectId?:    string;
  scores:        { performance: number; accessibility: number; bestPractices: number; seo: number };
  metrics:       { fcp: number; lcp: number; tbt: number; cls: number; si: number; tti: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fullResult?:   Record<string, any>;
  shareToken?:   string | null;
  /** Who asked for this run. Absent on documents written before the field existed,
   *  which were all manual — every query treats "not scheduled" as manual. */
  source?:       'manual' | 'scheduled';
  createdAt:     Date;
}

const HistorySchema = new Schema<IHistory>(
  {
    analysisId:    { type: String, required: true },
    shortId:       { type: String, required: true },
    url:           { type: String, required: true },
    normalizedUrl: { type: String, required: true },
    routePath:     { type: String, required: true, default: '/' },
    userId:        { type: String },
    projectId:     { type: String },
    scores:        { type: ScoresSchema, required: true },
    metrics:       { type: MetricsSchema, required: true },
    fullResult:    { type: Schema.Types.Mixed },
    shareToken:    { type: String, default: null, index: true, sparse: true },
    // Unattended runs pile up far faster than anything a person clicks, so they are kept
    // apart: the audit lists stay a record of what the user did, and the scheduled page
    // reports what the timetable found.
    source:        { type: String, enum: ['manual', 'scheduled'], default: 'manual' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Every read of this collection is scoped to one account and ordered by time, so the
// single-field indexes this schema used to carry could never serve a whole query — they
// narrowed to a user and left the sort to run in memory over the result. These four are
// the query shapes that exist; each one's leading field also covers the standalone lookup
// the old index did, which is why `userId`, `normalizedUrl`, `projectId` and `source` no
// longer declare one of their own. (Dropping them from the schema does not drop them from
// a database that already has them — mongoose only creates.)

// findPreviousRun, on every persisted audit: equality on both keys, newest first, limit 1.
HistorySchema.index({ userId: 1, url: 1, createdAt: -1 });

// A site's audit history and the dashboard's per-host averages. The host filter is an
// anchored regex, so it reads as a range on this index rather than a collection scan.
HistorySchema.index({ userId: 1, normalizedUrl: 1, createdAt: 1 });

// The manual and scheduled lists, and the dashboard's recent-activity window.
HistorySchema.index({ userId: 1, source: 1, createdAt: -1 });

// One project's runs, oldest first — the trend the project page draws.
HistorySchema.index({ projectId: 1, createdAt: 1 });

export const HistoryModel = mongoose.model<IHistory>('History', HistorySchema);
