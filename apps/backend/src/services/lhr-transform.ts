import type { RunnerResult } from 'lighthouse';
import { parseResources } from './resource-parser.js';
import { parseDependenciesFromArtifacts, parseDependencies, type CompactNetworkEvent } from './dependency-parser.js';
import { parseTimeline } from './timeline-parser.js';
import { parseCLSData } from './cls-parser.js';
import { parseThirdParties } from './third-party-parser.js';
import type {
  AnalysisResult,
  AuditItem,
  AuditImpact,
  AnalysisCategory,
  CategoryPartial,
  FlameChartData,
  HeapMemoryData,
  InteractionData,
} from '../types/index.js';

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

export function extractFailingAudits(
  audits: Record<string, { score?: number | null; title?: string; description?: string; displayValue?: string; details?: unknown }>,
): AuditItem[] {
  return Object.entries(audits)
    .filter(([, a]) => a.score !== null && (a.score ?? 1) < 0.9)
    .sort(([, a], [, b]) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, 15)
    .map(([id, a]): AuditItem => ({
      id,
      title: a.title ?? id,
      description: a.description ?? '',
      score: a.score ?? null,
      displayValue: a.displayValue,
      impact: scoreToImpact(a.score ?? null),
    }));
}

export function detectAuthRedirect(
  requestedUrl: string | undefined,
  finalUrl: string | undefined,
): { finalUrl: string } | undefined {
  if (!requestedUrl || !finalUrl || requestedUrl === finalUrl) return undefined;
  try {
    const req = new URL(requestedUrl);
    const fin = new URL(finalUrl);
    const authPattern = /\/(login|signin|sign[-_]in|auth|sso|oauth|session\/new|account\/login|users\/sign_in)/i;
    // Cross-origin redirect is almost always SSO/auth
    if (req.origin !== fin.origin) return { finalUrl };
    // Same origin but path changed to an auth route
    if (req.pathname !== fin.pathname && authPattern.test(fin.pathname)) return { finalUrl };
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
