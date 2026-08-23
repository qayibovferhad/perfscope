import { Schema, model, type Types } from 'mongoose';

/**
 * A release, recorded so a chart can say *why* a line moved.
 *
 * The charts already show that something changed on the eleventh. What they cannot show
 * is that the eleventh is when the image loader was swapped — and without that, reading a
 * regression means opening the git log with a date in hand and guessing. One row per
 * deploy turns "something got worse" into "this got worse after that".
 *
 * Written by CI, so the fields are whatever a pipeline happens to know: everything but
 * the site and the timestamp is optional, because a bare "we deployed" still beats a
 * chart with nothing on it.
 */
const deploySchema = new Schema(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true, index: true },
    /** When it went out — supplied by the caller, since CI usually records it afterwards. */
    at:        { type: Date, required: true },
    /** Commit sha, tag, build number: whatever the pipeline knows itself by. */
    ref:       { type: String, default: null },
    label:     { type: String, default: null },
    /** A commit, a PR, a pipeline run — somewhere to read what shipped. */
    url:       { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The only read there is: this site's deploys inside a window, newest first.
deploySchema.index({ websiteId: 1, at: -1 });

// A pipeline that retries its notify step should not draw the same release twice. Sparse
// because `ref` is optional, and scoped to the site so two projects may share a sha.
deploySchema.index({ websiteId: 1, ref: 1 }, { unique: true, sparse: true });

export interface IDeploy {
  _id:       Types.ObjectId;
  userId:    Types.ObjectId;
  websiteId: Types.ObjectId;
  at:        Date;
  ref:       string | null;
  label:     string | null;
  url:       string | null;
  createdAt: Date;
}

export const Deploy = model<IDeploy>('Deploy', deploySchema);
