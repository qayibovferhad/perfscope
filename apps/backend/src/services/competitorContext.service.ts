import type { ComparisonSide } from '@perfscope/shared';
import { CompareHistoryModel } from '../models/CompareHistory.model.js';
import { hostOf } from '../lib/url.js';

export interface CompetitorComparison {
  competitorUrl:      string;
  competitorHostname: string;
  mine:    ComparisonSide;
  theirs:  ComparisonSide;
  winner:  'mine' | 'competitor' | 'tie';
  comparedAt: string;
  /** Gemini's read on the matchup, written once when the Compare run was saved. */
  aiVerdict?: string;
}

/**
 * This user's most recent Compare run involving this URL's host, reoriented around "mine"
 * vs "theirs" — `CompareHistory` stores every pair as `source`/`competitor` from the
 * comparison page's own perspective, which is not necessarily this URL's side.
 *
 * Mirrors `previousRun.service.ts`'s shape: one most-recent doc, narrow `.select()`,
 * `.lean()`, `.catch(() => null)`. A user who never ran Compare against this page, or
 * whose only compares are for a different site, gets `null` — a normal outcome, same as
 * no earlier audit.
 */
export async function getLatestCompetitorComparison(
  userId: string, url: string,
): Promise<CompetitorComparison | null> {
  const host = hostOf(url);
  if (!host) return null;

  const doc = await CompareHistoryModel
    .findOne({ userId, $or: [{ sourceHostname: host }, { targetHostname: host }] })
    .sort({ createdAt: -1 })
    .select('sourceUrl targetUrl sourceHostname targetHostname source competitor winner aiVerdict createdAt')
    .lean()
    .catch(() => null);
  if (!doc) return null;

  const mineIsSource = doc.sourceHostname === host;
  const mine   = mineIsSource ? doc.source     : doc.competitor;
  const theirs = mineIsSource ? doc.competitor : doc.source;
  const competitorHostname = mineIsSource ? doc.targetHostname : doc.sourceHostname;

  const winner: CompetitorComparison['winner'] =
    doc.winner === 'tie' ? 'tie' : (doc.winner === 'source') === mineIsSource ? 'mine' : 'competitor';

  return {
    competitorUrl: mineIsSource ? doc.targetUrl ?? competitorHostname : doc.sourceUrl ?? competitorHostname,
    competitorHostname,
    mine, theirs, winner,
    comparedAt: new Date(doc.createdAt as unknown as string).toISOString().slice(0, 10),
    ...(doc.aiVerdict ? { aiVerdict: doc.aiVerdict } : {}),
  };
}
