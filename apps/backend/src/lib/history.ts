import { HAS_RESULT_FIELDS } from '@perfscope/shared';

/**
 * Mongo-side twin of the client's `hasResult()`.
 *
 * A run that failed is still persisted, but with every score and metric at 0. Those
 * must never count towards an average, a site's "audited" flag, or a digest — a stored
 * 0-score audit of a page that never loaded would drag a healthy site's score down and
 * read as a regression. Built from HAS_RESULT_FIELDS so the two definitions cannot drift.
 */
export const HAS_RESULT_FILTER = {
  $or: HAS_RESULT_FIELDS.map((field) => ({ [field]: { $gt: 0 } })),
};
