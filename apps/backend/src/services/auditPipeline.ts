import { AiService } from './ai.service.js';
import { HistoryService } from './history.service.js';
import { checkBudgets } from './budget.service.js';
import type { AnalysisResult } from '../types/index.js';

/** Cap on critical resources sent for per-resource AI advice. */
const AI_CRITICAL_LIMIT = 6;

/** One length everywhere — a 7-char short id must identify the same audit at every entry point. */
export const SHORT_ID_LEN = 7;

/**
 * Attach Gemini insights + per-resource advice to the result in place.
 * No-op when no API key is configured; individual AI failures are logged and
 * never fail the audit itself.
 */
export async function enrichWithAi(result: AnalysisResult): Promise<void> {
  if (!AiService.isAvailable()) return;

  const criticals = (result.resources?.requests ?? [])
    .filter((r) => r.isCritical)
    .slice(0, AI_CRITICAL_LIMIT);

  const [insights, adviceMap] = await Promise.all([
    AiService.getInsights(result).catch((err: unknown) => {
      console.error('[AI] Insights failed:', err);
      return null;
    }),
    criticals.length > 0
      ? AiService.getResourceAdvice(criticals).catch((err: unknown) => {
          console.error('[AI] Resource advice failed:', err);
          return new Map<string, string>();
        })
      : Promise.resolve(new Map<string, string>()),
  ]);

  if (insights) result.aiInsights = insights;

  if (adviceMap.size > 0 && result.resources) {
    for (const req of result.resources.requests) {
      const advice = adviceMap.get(req.url);
      if (advice) req.advice = advice;
    }
  }
}

/** Persist the audit summary + full result under the owning user/project. */
export async function persistAudit(
  result: AnalysisResult,
  userId: string | undefined,
  projectId: string | undefined,
): Promise<void> {
  await HistoryService.save(
    {
      id:        result.id,
      shortId:   result.id.slice(0, SHORT_ID_LEN),
      url:       result.url,
      timestamp: result.timestamp,
      scores:    result.scores,
      metrics:   result.metrics,
    },
    userId,
    projectId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result as unknown as Record<string, any>,
  );

  // Budget evaluation rides on the same choke point every entry path funnels
  // through; a failure here must never fail the audit itself.
  await checkBudgets(result, userId).catch((err: unknown) =>
    console.warn('[Budgets] Check failed:', err));
}
