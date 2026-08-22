import { AiService } from './ai.service.js';
import { getRecommendationHistory, reconcileRecommendations } from './aiRecommendation.service.js';
import { getPreviousRun } from './previousRun.service.js';
import { HistoryService } from './history.service.js';
import { Website } from '../models/Website.model.js';
import { findWebsiteByHost } from './websiteLookup.js';
import { checkBudgets } from './budget.service.js';
import { checkRegressions } from './regression.service.js';
import { CruxService } from './crux.service.js';
import { getOtherRoutesVendors } from './crossPageVendors.service.js';
import { getRumSummaryForUrl } from './rum.service.js';
import { getLatestCompetitorComparison } from './competitorContext.service.js';
import type { AuditSource, AnalysisResult, AiMetricNotes, AiPageAnalysis } from '@perfscope/shared';

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
  // `userId` is optional and may be explicitly undefined — an anonymous audit has no
  // history to compare against, which is the same as having no earlier run.
  { depth = 'standard', userId }: { depth?: AiDepth; userId?: string | undefined } = {},
): Promise<AiEnrichment> {
  const nothing: AiEnrichment = {
    insights: null, advice: new Map(), auditExplanations: new Map(), metricNotes: {}, waterfall: null,
  };
  if (!AiService.isAvailable()) return nothing;

  const heaviest = (result.resources?.requests ?? [])
    .filter((r) => AI_ADVICE_TYPES.has(r.resourceType) && r.transferSize >= AI_ADVICE_MIN_BYTES)
    .sort((a, b) => b.transferSize - a.transferSize)
    .slice(0, AI_ADVICE_LIMIT);

  // The deep-mode context set, gathered in one Promise.all: five Mongo lookups and one
  // external HTTP call (CrUX) that are mutually independent — run serially they stack
  // their latencies onto `analysis:insights`, the one event a user actually waits on.
  // Each carries its own catch: no owner, no storage, no data or a failed request all
  // mean the same thing here — compare against nothing — and none is worth failing over.
  const [previous, recommendationHistory, fieldData, otherRoutesVendors, rumData, competitor] = await Promise.all([
    // What this page measured last time, so the analysis can lead with what moved — and,
    // via diffResources inside buildPageContext, name the actual file responsible.
    depth === 'deep' && userId
      ? getPreviousRun(userId, result.url, new Date(result.timestamp)).catch(() => null)
      : null,

    // What the AI has already told this user about this page, so it can notice a repeat
    // instead of restating itself for the sixth audit in a row — or notice that something
    // it flagged before is no longer in the fixes and say so.
    depth === 'deep' && userId
      ? getRecommendationHistory(userId, result.url).catch(() => [])
      : [],

    // Real users, not just this one lab run — CruxService.get already sat next to the lab
    // numbers on screen without either surface comparing them.
    depth === 'deep'
      ? CruxService.get(result.url, result.formFactor ?? 'desktop').catch(() => null)
      : null,

    // Same vendor, several of this user's other pages — not this page's problem alone.
    depth === 'deep' && userId
      ? getOtherRoutesVendors(userId, result.url).catch(() => [])
      : [],

    // This site's own visitors, when it has a RUM snippet installed — a second, independent
    // field reading next to CrUX's public one. Scoped to the owner's own tracked site, so
    // (unlike CrUX) it needs a userId, not just a URL.
    depth === 'deep' && userId
      ? getRumSummaryForUrl(userId, result.url, result.formFactor).catch(() => null)
      : null,

    // This user's most recent Compare run against this page's host, when there is one —
    // what lets the diagnosis and the ask box talk about a competitor instead of declining.
    depth === 'deep' && userId
      ? getLatestCompetitorComparison(userId, result.url).catch(() => null)
      : null,
  ]);

  // One Promise.all, so the deep work costs the same wall time as the standard path — and
  // each carries its own catch, so a failing prompt cannot take the others (or the audit)
  // with it.
  const [analysis, adviceMap] = await Promise.all([
    depth === 'deep'
      ? AiService.analysePage(result, previous, recommendationHistory, fieldData, otherRoutesVendors, rumData, competitor).catch((err: unknown) => {
          console.error('[AI] Page analysis failed:', err);
          return null;
        })
      // 'standard' still wants the headline fixes, and nothing reads the rest of the
      // analysis on that path — the nightly cron's result is charted, not read.
      : AiService.getInsights(result)
          .then((text): AiPageAnalysis | null => text
            ? { diagnosis: '', fixes: [text], metrics: {}, waterfall: null, audits: {} }
            : null)
          .catch((err: unknown) => {
            console.error('[AI] Insights failed:', err);
            return null;
          }),
    heaviest.length > 0
      ? AiService.getResourceAdvice(heaviest).catch((err: unknown) => {
          console.error('[AI] Resource advice failed:', err);
          return new Map<string, string>();
        })
      : Promise.resolve(new Map<string, string>()),
  ]);

  // Fold this run's fixes into the recommendation history — bumps repeats, resolves
  // whatever dropped out of the list. Deep-only: 'standard' fixes are one collapsed
  // string (see the getInsights branch above), not discrete recommendations to track.
  // An empty fix list is a real deep-mode outcome now (a page with nothing material left),
  // and reconciling it is the point: it resolves whatever was outstanding, which is how the
  // next audit gets to open with "the thing you fixed is fixed".
  if (depth === 'deep' && userId && analysis) {
    await reconcileRecommendations(userId, result, analysis.fixes);
  }

  // The diagnosis leads, because it is the thing the rest was derived from; without it the
  // fixes read as three unrelated suggestions, which is what they used to be.
  const insights = analysis
    ? [analysis.diagnosis, ...analysis.fixes].filter(Boolean).join('\n\n')
    : null;
  const auditExplanations = new Map(Object.entries(analysis?.audits ?? {}));
  const narrative = { metrics: analysis?.metrics ?? {}, waterfall: analysis?.waterfall ?? null };

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
