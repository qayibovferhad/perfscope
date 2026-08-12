import { AiService } from './ai.service.js';
import { HistoryService } from './history.service.js';
import { Website } from '../models/Website.model.js';
import { findWebsiteByHost } from './websiteLookup.js';
import { checkBudgets } from './budget.service.js';
import { checkRegressions } from './regression.service.js';
import type { AnalysisResult } from '../types/index.js';
import type { AuditSource } from '@perfscope/shared';

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
/**
 * The project an audit belongs to, creating the site on first sight.
 *
 * The REST entry path used to answer this itself, with a different algorithm from the
 * socket path's — it loaded every website and matched hostnames in JS, so the two could
 * file the same URL under different projects. One definition, one lookup.
 */
export async function resolveOrCreateProject(userId: string, url: string): Promise<string> {
  const existing = await findWebsiteByHost(userId, url);
  if (existing) return String(existing._id);

  const { origin, hostname } = new URL(url);
  const created = await Website.create({ userId, url: origin, name: hostname });
  return String(created._id);
}

export async function persistAudit(
  result: AnalysisResult,
  userId: string | undefined,
  projectId: string | undefined,
  /** 'scheduled' for anything the cron started — those are listed on their own page. */
  source: AuditSource = 'manual',
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
    source,
  );

  // Budget and regression checks ride on the same choke point every entry path funnels
  // through; a failure in either must never fail the audit itself. They run after the
  // save so the regression check can read this run's predecessor from history.
  await Promise.all([
    checkBudgets(result, userId).catch((err: unknown) =>
      console.warn('[Budgets] Check failed:', err)),
    checkRegressions(result, userId).catch((err: unknown) =>
      console.warn('[Regressions] Check failed:', err)),
  ]);
}
