import { AiService } from './ai.service.js';
import { HistoryService } from './history.service.js';
import { Website } from '../models/Website.model.js';
import { findWebsiteByHost } from './websiteLookup.js';
import { checkBudgets } from './budget.service.js';
import { checkRegressions } from './regression.service.js';
import type { AuditSource, AnalysisResult, AiMetricNotes } from '@perfscope/shared';

/** How many resources get their own AI tip. */
const AI_ADVICE_LIMIT = 6;

/**
 * Floor for advising a resource at all (bytes, over the wire).
 *
 * Advice used to be gated on `NetworkRequest.isCritical`, which means "over 500 KB for a
 * script, 1 MB for an image". Those are transfer sizes, i.e. post-compression, and only
 * 9 of the 51 stored audits have ever had a resource reach one — all of them dev builds
 * serving unminified bundles. So four in five audits got no advice at all, not because the
 * page had nothing worth saying but because nothing on it was enormous.
 *
 * Weight is still the right signal; the threshold just has to be one ordinary pages cross.
 * The heaviest handful above this floor is what a person would look at first.
 */
const AI_ADVICE_MIN_BYTES = 30 * 1024;

/** Types worth a size tip. A large document or XHR is a backend problem, not a payload one. */
const AI_ADVICE_TYPES: ReadonlySet<string> = new Set(['script', 'stylesheet', 'image', 'font', 'media']);

/** One length everywhere — a 7-char short id must identify the same audit at every entry point. */
export const SHORT_ID_LEN = 7;

/** Everything Gemini had to say — the same values enrichWithAi writes onto the result. */
export interface AiEnrichment {
  insights: string | null;
  advice:   Map<string, string>;
  /** Keyed by `AuditItem.id`. Empty at 'standard' depth. */
  auditExplanations: Map<string, string>;
  /** Keyed by vital. Empty at 'standard' depth. */
  metricNotes: AiMetricNotes;
  /** Empty at 'standard' depth. */
  waterfall: string | null;
}

/**
 * How much commentary to ask for.
 *
 * `deep` costs two extra Gemini calls and is worth it only where someone is looking at the
 * page it decorates. The nightly cron and the legacy REST path stay `standard`: their
 * results feed trends and alerts, and nobody reads a per-audit explanation from a run that
 * happened at 03:00.
 */
export type AiDepth = 'standard' | 'deep';

/**
 * Attach Gemini's commentary to the result in place, and return it.
 * No-op when no API key is configured; individual AI failures are logged and
 * never fail the audit itself.
 *
 * Returned as well as written because the socket path emits `analysis:complete` before
 * this finishes and ships the commentary as its own event afterwards — it needs the values,
 * not just a mutated object it already sent.
 */
export async function enrichWithAi(
  result: AnalysisResult,
  { depth = 'standard' }: { depth?: AiDepth } = {},
): Promise<AiEnrichment> {
  const nothing: AiEnrichment = {
    insights: null, advice: new Map(), auditExplanations: new Map(), metricNotes: {}, waterfall: null,
  };
  if (!AiService.isAvailable()) return nothing;

  const heaviest = (result.resources?.requests ?? [])
    .filter((r) => AI_ADVICE_TYPES.has(r.resourceType) && r.transferSize >= AI_ADVICE_MIN_BYTES)
    .sort((a, b) => b.transferSize - a.transferSize)
    .slice(0, AI_ADVICE_LIMIT);

  // One Promise.all, so the deep prompts cost the same wall time as the standard ones —
  // and each carries its own catch, so a single failing prompt cannot take the others
  // (or the audit) with it.
  const [insights, adviceMap, auditExplanations, narrative] = await Promise.all([
    AiService.getInsights(result).catch((err: unknown) => {
      console.error('[AI] Insights failed:', err);
      return null;
    }),
    heaviest.length > 0
      ? AiService.getResourceAdvice(heaviest).catch((err: unknown) => {
          console.error('[AI] Resource advice failed:', err);
          return new Map<string, string>();
        })
      : Promise.resolve(new Map<string, string>()),
    depth === 'deep'
      ? AiService.getAuditExplanations(result).catch((err: unknown) => {
          console.error('[AI] Audit explanations failed:', err);
          return new Map<string, string>();
        })
      : Promise.resolve(new Map<string, string>()),
    depth === 'deep'
      ? AiService.getPageNarrative(result).catch((err: unknown) => {
          console.error('[AI] Page narrative failed:', err);
          return { metrics: {} as AiMetricNotes, waterfall: null };
        })
      : Promise.resolve({ metrics: {} as AiMetricNotes, waterfall: null }),
  ]);

  if (insights) result.aiInsights = insights;

  if (adviceMap.size > 0 && result.resources) {
    for (const req of result.resources.requests) {
      const advice = adviceMap.get(req.url);
      if (advice) req.advice = advice;
    }
  }

  // Written onto the result, not just returned, so `persistAudit` stores them and a
  // reopened audit shows its AI without another Gemini call.
  if (auditExplanations.size > 0) {
    for (const audit of result.audits) {
      const explanation = auditExplanations.get(audit.id);
      if (explanation) audit.aiExplanation = explanation;
    }
  }
  if (Object.keys(narrative.metrics).length > 0) result.aiMetricNotes = narrative.metrics;
  if (narrative.waterfall) result.aiWaterfallNarrative = narrative.waterfall;

  return {
    insights, advice: adviceMap,
    auditExplanations, metricNotes: narrative.metrics, waterfall: narrative.waterfall,
  };
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
  //
  // Both need the owning site and were fetching it separately with the same regex query.
  // Resolved once — but here rather than at the start of the audit: checkBudgets mutates
  // and saves this document, and a run takes tens of seconds, so a handle taken any
  // earlier could overwrite a budget the user edited while it was measuring.
  const site = userId ? await findWebsiteByHost(userId, result.url) : null;

  await Promise.all([
    checkBudgets(result, site).catch((err: unknown) =>
      console.warn('[Budgets] Check failed:', err)),
    checkRegressions(result, userId, site).catch((err: unknown) =>
      console.warn('[Regressions] Check failed:', err)),
  ]);
}
