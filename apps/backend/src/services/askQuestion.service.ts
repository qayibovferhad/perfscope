import type { AnalysisResult } from '@perfscope/shared';
import { AiService } from './ai.service.js';
import { getRecommendationHistory } from './aiRecommendation.service.js';
import { HistoryModel } from '../models/History.model.js';
import { HAS_RESULT_FILTER } from '../lib/history.js';

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

  const previous = await HistoryModel
    .findOne({
      userId, url: result.url,
      analysisId: { $ne: analysisId },
      createdAt:  { $lt: doc.createdAt },
      ...HAS_RESULT_FILTER,
    })
    .sort({ createdAt: -1 })
    .select('scores metrics createdAt')
    .lean()
    .then(p => p ? {
      scores:  p.scores  as unknown as AnalysisResult['scores'],
      metrics: p.metrics as unknown as AnalysisResult['metrics'],
      at:      new Date(p.createdAt as unknown as string).toISOString().slice(0, 10),
    } : null)
    .catch(() => null);

  const history = await getRecommendationHistory(userId, result.url).catch(() => []);

  const answer = await AiService.answerQuestion(result, question, previous, history);
  if (!answer) return { status: 'no_answer' };

  // Only spent on an actual answer — a Gemini timeout or an empty reply should not cost
  // the user one of their five.
  await HistoryModel.updateOne({ _id: doc._id }, { $inc: { aiQuestionsAsked: 1 } });

  return { status: 'ok', answer, questionsRemaining: MAX_QUESTIONS_PER_AUDIT - asked - 1 };
}
