import type { AnalysisResult } from '@perfscope/shared';
import { AiService } from './ai.service.js';
import { getRecommendationHistory } from './aiRecommendation.service.js';
import { getPreviousRun } from './previousRun.service.js';
import { CruxService } from './crux.service.js';
import { getOtherRoutesVendors } from './crossPageVendors.service.js';
import { getRumSummaryForUrl } from './rum.service.js';
import { getLatestCompetitorComparison } from './competitorContext.service.js';
import { HistoryModel } from '../models/History.model.js';

/** "Sonsuz sual = sonsuz xərc" — a soft cap, not billing-critical, so a small race on the
 *  count under concurrent requests is an acceptable trade against not punishing the user
 *  for a failed Gemini call by spending a slot on it (see `askAboutAudit`). */
export const MAX_QUESTIONS_PER_AUDIT = 5;

export type AskResult =
  | { status: 'not_found' }
  | { status: 'limit_reached' }
  | { status: 'no_answer' }
  | { status: 'ok'; answer: string; questionsRemaining: number };

/**
 * Answers one question against one audit's own evidence — the analyzer's monologue, made
 * answerable. Builds exactly the context `analysePage` saw (same `previous` lookup, same
 * recommendation history) so an answer here cannot contradict the diagnosis sitting above
 * the question box on screen.
 */
export async function askAboutAudit(
  userId: string, analysisId: string, question: string,
): Promise<AskResult> {
  const doc = await HistoryModel.findOne({ analysisId, userId });
  if (!doc || !doc.fullResult) return { status: 'not_found' };

  const asked = doc.aiQuestionsAsked ?? 0;
  if (asked >= MAX_QUESTIONS_PER_AUDIT) return { status: 'limit_reached' };

  const result = doc.fullResult as unknown as AnalysisResult;

  // Same form factor, same reason as everywhere else: the run before *this* one on the
  // same device profile is the only honest comparison to answer a question against.
  const previous = await getPreviousRun(userId, result.url, doc.createdAt, result.formFactor).catch(() => null);

  const history = await getRecommendationHistory(userId, result.url).catch(() => []);

  const fieldData = await CruxService.get(result.url, result.formFactor ?? 'desktop').catch(() => null);

  const otherRoutesVendors = await getOtherRoutesVendors(userId, result.url).catch(() => []);

  const rumData = await getRumSummaryForUrl(userId, result.url, result.formFactor).catch(() => null);

  const competitor = await getLatestCompetitorComparison(userId, result.url).catch(() => null);

  const answer = await AiService.answerQuestion(result, question, previous, history, fieldData, otherRoutesVendors, rumData, competitor)
    .catch(() => null);
  if (!answer) return { status: 'no_answer' };

  // Only spent on an actual answer — a Gemini timeout or an empty reply should not cost
  // the user one of their five.
  await HistoryModel.updateOne({ _id: doc._id }, { $inc: { aiQuestionsAsked: 1 } });

  return { status: 'ok', answer, questionsRemaining: MAX_QUESTIONS_PER_AUDIT - asked - 1 };
}
