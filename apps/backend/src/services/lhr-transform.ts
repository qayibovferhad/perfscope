import type { RunnerResult } from 'lighthouse';
import { parseResources } from './resource-parser.js';
import { parseDependenciesFromArtifacts, parseDependencies, type CompactNetworkEvent } from './dependency-parser.js';
import { parseTimeline } from './timeline-parser.js';
import { parseCLSData } from './cls-parser.js';
import { parseThirdParties } from './third-party-parser.js';
import type { AnalysisResult, AuditItem, AuditDetail, AuditImpact, AnalysisCategory, CategoryPartial, FlameChartData, HeapMemoryData, InteractionData } from '@perfscope/shared';

/** Lighthouse item shapes vary by audit: DOM audits nest `node.selector`/`node.snippet`,
 *  network audits carry `url`, opportunities carry a wasted-bytes/wasted-ms/total-bytes
 *  figure. Normalise whatever is present; skip items that carry none of it. Capped at 5 —
 *  an audit with 300 unlabelled images explains itself in three, and `fullResult` still
 *  has to fit in the AI prompt and the database. Strings truncated to ~120 chars for the
 *  same reason. */
const AUDIT_DETAIL_LIMIT = 5;

/** Keeps the start — right for snippets, where the tag name and key attributes lead. */
const truncateHead = (s: string, max = 120): string => (s.length > max ? s.slice(0, max - 1) + '…' : s);

/** Keeps the end — right for URLs, where the filename/query is at the tail, not the host. */
const truncateTail = (s: string, max = 120): string => (s.length > max ? '…' + s.slice(-(max - 1)) : s);

/**
 * A CSS ancestor-chain selector's useful part — the actual failing element, not the divs
 * around it — is its *last* segment. Truncating from the head (as every other field does)
 * was cutting that segment off mid-class-name, e.g. "div.Foo > div.Bar > a.Anc…" instead of
 * the class the model needed to cite.
 */
const truncateSelector = (selector: string, max = 120): string => {
  const parts = selector.split(' > ');
  const last = parts[parts.length - 1] ?? selector;
  if (last.length <= max) return parts.length > 1 ? `… > ${last}` : last;
  return truncateTail(last, max);
};

export function extractAuditDetails(details: unknown): AuditDetail[] | undefined {
  if (!details || typeof details !== 'object') return undefined;
  const items = (details as { items?: unknown[] }).items;
  if (!Array.isArray(items) || items.length === 0) return undefined;

  const out: AuditDetail[] = [];
  for (const raw of items) {
    if (out.length >= AUDIT_DETAIL_LIMIT) break;
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const node = item['node'] as Record<string, unknown> | undefined;

    const selector = typeof node?.['selector'] === 'string' ? truncateSelector(node['selector'] as string) : undefined;
    const snippet  = typeof node?.['snippet']  === 'string' ? truncateHead(node['snippet']  as string) : undefined;
    const url      = typeof item['url']        === 'string' ? truncateTail(item['url']      as string) : undefined;

    let value: string | undefined;
    if (typeof item['value'] === 'string')            value = truncateHead(item['value'] as string);
    else if (typeof item['wastedMs'] === 'number')     value = `${Math.round(item['wastedMs'] as number)}ms wasted`;
    else if (typeof item['wastedBytes'] === 'number')  value = `${Math.round((item['wastedBytes'] as number) / 1024)}KB wasted`;
    else if (typeof item['totalBytes'] === 'number')   value = `${Math.round((item['totalBytes'] as number) / 1024)}KB`;

    if (!selector && !snippet && !url && !value) continue;
    out.push({
      ...(selector ? { selector } : {}),
      ...(snippet  ? { snippet }  : {}),
      ...(url      ? { url }      : {}),
      ...(value    ? { value }    : {}),
    });
  }
  return out.length > 0 ? out : undefined;
}

export function toScore(raw: number | null | undefined): number {
  return Math.round((raw ?? 0) * 100);
}

export function scoreToImpact(score: number | null): AuditImpact {
  if (score === null) return 'low';
  if (score < 0.25) return 'critical';
  if (score < 0.5) return 'high';
  if (score < 0.75) return 'medium';
  return 'low';
}

/**
 * `overallSavingsMs`/`overallSavingsBytes` sit on the same `details` object as `items`,
 * but only on "opportunity" audits (render-blocking-resources, unused-javascript, …) —
 * most diagnostics never compute one. Lighthouse's own number for "how much this is
 * actually costing", previously only reachable as unstructured text inside
 * `displayValue`.
 */
function extractSavings(details: unknown): { savingsMs?: number; savingsBytes?: number } {
  if (!details || typeof details !== 'object') return {};
  const d = details as { overallSavingsMs?: unknown; overallSavingsBytes?: unknown };
  const out: { savingsMs?: number; savingsBytes?: number } = {};
  if (typeof d.overallSavingsMs === 'number' && d.overallSavingsMs > 0) out.savingsMs = Math.round(d.overallSavingsMs);
  if (typeof d.overallSavingsBytes === 'number' && d.overallSavingsBytes > 0) out.savingsBytes = Math.round(d.overallSavingsBytes);
  return out;
}

export function extractFailingAudits(
  audits: Record<string, { score?: number | null; title?: string; description?: string; displayValue?: string; details?: unknown }>,
): AuditItem[] {
  return Object.entries(audits)
    .filter(([, a]) => a.score !== null && (a.score ?? 1) < 0.9)
    .sort(([, a], [, b]) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, 15)
    .map(([id, a]): AuditItem => {
      const details = extractAuditDetails(a.details);
      const savings = extractSavings(a.details);
      return {
        id,
        title: a.title ?? id,
        description: a.description ?? '',
        score: a.score ?? null,
        displayValue: a.displayValue,
        impact: scoreToImpact(a.score ?? null),
        ...(details ? { details } : {}),
        ...savings,
      };
    });
}

export function detectAuthRedirect(
  requestedUrl: string | undefined,
  finalUrl: string | undefined,
): { finalUrl: string } | undefined {
  if (!requestedUrl || !finalUrl || requestedUrl === finalUrl) return undefined;
  try {
    const fin = new URL(finalUrl);
    const authPattern = /\/(login|signin|sign[-_]in|auth|sso|oauth|session\/new|account\/login|users\/sign_in)/i;
    // Used to also flag *any* cross-origin redirect as auth — wikipedia.org → www.wikipedia.org
    // is exactly that (different host, so a different origin) and has nothing to do with a
    // login wall; so does an apex→www redirect, a geoIP/language subdomain hop, or a plain
    // http→https upgrade landing on a different host. The destination path actually looking
    // like a login route is the one signal that isn't also true of an ordinary redirect,
    // cross-origin or not — an SSO bounce to a separate accounts domain still lands on a
    // path like /login or /oauth, same as a same-origin one does.
    if (authPattern.test(fin.pathname)) return { finalUrl };
  } catch { /* ignore malformed URLs */ }
  return undefined;
}

export function buildPartial(
  analysisId: string,
  category: AnalysisCategory,
  lhr: RunnerResult['lhr'],
): CategoryPartial {
  const categoryKey = category === 'best-practices' ? 'best-practices' : category;
  const score = toScore(lhr.categories[categoryKey]?.score);
  const audits = extractFailingAudits(lhr.audits);

  const partial: CategoryPartial = { analysisId, category, score, audits };

  if (category === 'performance') {
    partial.metrics = extractCoreWebVitals(lhr);
  }

  return partial;
}

function extractCoreWebVitals(lhr: RunnerResult['lhr']) {
  return {
    fcp: lhr.audits['first-contentful-paint']?.numericValue ?? 0,
    lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? 0,
    tbt: lhr.audits['total-blocking-time']?.numericValue ?? 0,
    cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? 0,
    si:  lhr.audits['speed-index']?.numericValue ?? 0,
    tti: lhr.audits['interactive']?.numericValue ?? 0,
  };
}

/** Merge category LHRs into the final AnalysisResult, running every artifact parser. */
export function buildFullResult(
  id: string,
  url: string,
  lhrs: RunnerResult['lhr'][],
  flameChartData?: FlameChartData,
  heapMemoryData?: HeapMemoryData,
  interactionData?: InteractionData,
  networkEvents?: CompactNetworkEvent[],
  artifacts?: unknown,
): AnalysisResult {
  const scores = { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };
  let metrics = { fcp: 0, lcp: 0, tbt: 0, cls: 0, si: 0, tti: 0 };
  const allAudits: AuditItem[] = [];
  let performanceLhr: RunnerResult['lhr'] | null = null;

  for (const lhr of lhrs) {
    scores.performance   = Math.max(scores.performance,   toScore(lhr.categories['performance']?.score));
    scores.accessibility = Math.max(scores.accessibility, toScore(lhr.categories['accessibility']?.score));
    scores.bestPractices = Math.max(scores.bestPractices, toScore(lhr.categories['best-practices']?.score));
    scores.seo           = Math.max(scores.seo,           toScore(lhr.categories['seo']?.score));

    if (lhr.categories['performance']) {
      metrics = extractCoreWebVitals(lhr);
      performanceLhr = lhr;
    }

    allAudits.push(...extractFailingAudits(lhr.audits));
  }

  // Deduplicate audits by id
  const seen = new Set<string>();
  const uniqueAudits = allAudits.filter(({ id: auditId }) =>
    seen.has(auditId) ? false : (seen.add(auditId), true),
  );

  // Parse resources and timeline from the performance LHR
  const result: AnalysisResult = { id, url, timestamp: new Date().toISOString(), scores, metrics, audits: uniqueAudits };
  if (performanceLhr) {
    result.resources = parseResources(performanceLhr, url);
    const timeline = parseTimeline(performanceLhr);
    if (timeline) result.timelineData = timeline;

    const clsData = parseCLSData(performanceLhr);
    if (clsData) result.clsData = clsData;

    const thirdParty = parseThirdParties(performanceLhr, result.resources?.requests ?? []);
    if (thirdParty) result.thirdParty = thirdParty;

    // Build dependency graph — prefer worker-extracted events, fall back to raw artifacts
    const requests = result.resources?.requests ?? [];
    if (networkEvents && networkEvents.length > 0) {
      const graph = parseDependencies(networkEvents, requests);
      if (graph) result.dependencyGraph = graph;
    } else if (artifacts) {
      const graph = parseDependenciesFromArtifacts(artifacts, requests);
      if (graph) result.dependencyGraph = graph;
    }
  }
  if (flameChartData)  result.flameChartData  = flameChartData;
  if (heapMemoryData)  result.heapMemoryData  = heapMemoryData;
  if (interactionData) result.interactionData = interactionData;

  // Detect auth redirect: check all LHRs for a redirect to a login/auth page
  for (const lhr of lhrs) {
    const redirect = detectAuthRedirect(lhr.requestedUrl, lhr.finalDisplayedUrl ?? (lhr as unknown as Record<string, string>)['finalUrl']);
    if (redirect) { result.authRedirectDetected = redirect; break; }
  }

  return result;
}
