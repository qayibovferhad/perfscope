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

/**
 * Runs a person asked for, as opposed to the timetable.
 *
 * `$ne` rather than `= 'manual'` on purpose: every audit stored before `source` existed
 * was run by hand, and those documents have no field to match.
 */
export const MANUAL_ONLY_FILTER = { source: { $ne: 'scheduled' as const } };

/** The mirror image — what the automation produced. */
export const SCHEDULED_ONLY_FILTER = { source: 'scheduled' as const };
