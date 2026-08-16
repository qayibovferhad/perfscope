import { fmtMs } from '@perfscope/shared';
import type { AiAdviceAction } from '@perfscope/shared';
import { AiActionLogModel } from '../models/AiActionLog.model.js';
import { HistoryModel } from '../models/History.model.js';
import { HAS_RESULT_FILTER } from '../lib/history.js';

export async function recordAdviceAction(
  userId: string, kind: AiAdviceAction['kind'], url: string,
): Promise<void> {
  await AiActionLogModel.create({ userId, kind, url, actedAt: new Date() });
}

function hoursAgo(at: Date): number {
  return Math.max(0, Math.round((Date.now() - at.getTime()) / 3_600_000));
}

/**
 * "You told them to audit; they did; here's what moved" — but only in the narrow window
 * where that is still the news. Requires three things:
 *   1. an 'audit' action was logged for this url,
 *   2. a run exists from AFTER that click — they actually came back and did it,
 *   3. that run is the newest one for this url — nothing has happened since that would
 *      make the click old news rather than the thing that just occurred.
 * Only 'audit' has a directly measurable outcome (a before/after score); the other three
 * action kinds are logged for future phases but do not produce a line here.
 */
export async function getActionOutcome(userId: string, url: string): Promise<string | null> {
  const action = await AiActionLogModel
    .findOne({ userId, url, kind: 'audit' })
    .sort({ actedAt: -1 })
    .lean();
  if (!action) return null;

  const [latest, prior] = await HistoryModel
    .find({ userId, url, ...HAS_RESULT_FILTER })
    .sort({ createdAt: -1 })
    .limit(2)
    .select('scores metrics createdAt')
    .lean();
  if (!latest || !prior) return null;

  const actedAt = new Date(action.actedAt as unknown as string);
  // The most recent run must postdate the click (they actually re-audited since asking),
  // and the run before it must predate the click (that is the "before" the click compared
  // against) — otherwise both runs happened on the same side of the click and this is not
  // the direct before/after pair.
  if (new Date(latest.createdAt as unknown as string) <= actedAt) return null;
  if (new Date(prior.createdAt as unknown as string) > actedAt) return null;

  const scoreBefore = prior.scores?.performance ?? 0;
  const scoreAfter  = latest.scores?.performance ?? 0;
  const lcpBefore   = prior.metrics?.lcp ?? 0;
  const lcpAfter    = latest.metrics?.lcp ?? 0;

  return `The user acted on your advice to audit this page ~${hoursAgo(actedAt)}h ago and re-ran it since. `
    + `Performance went ${scoreBefore} -> ${scoreAfter}, LCP ${fmtMs(lcpBefore)} -> ${fmtMs(lcpAfter)}. `
    + `Lead the headline with this outcome — say plainly whether it helped, using these exact numbers.`;
}
