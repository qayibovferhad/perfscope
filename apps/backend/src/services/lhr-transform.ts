import type { RunnerResult } from 'lighthouse';
import { parseResources } from './resource-parser.js';
import { parseDependenciesFromArtifacts, parseDependencies, type CompactNetworkEvent } from './dependency-parser.js';
import { parseTimeline } from './timeline-parser.js';
import { parseCLSData } from './cls-parser.js';
import { parseThirdParties } from './third-party-parser.js';
import { parseBundles } from './bundle-parser.js';
import type { AnalysisResult, AuditItem, AuditDetail, AuditImpact, AnalysisCategory, CategoryPartial, FlameChartData, HeapMemoryData, InteractionData } from '@perfscope/shared';

/** Lighthouse item shapes vary by audit: DOM audits nest `node.selector`/`node.snippet`,
 *  network audits carry `url`, opportunities carry a wasted-bytes/wasted-ms/total-bytes
 *  figure. Normalise whatever is present; skip items that carry none of it. Capped at 5 —
 *  an audit with 300 unlabelled images explains itself in three, and `fullResult` still
 *  has to fit in the AI prompt and the database. Strings truncated to ~120 chars for the
 *  same reason. */
const AUDIT_DETAIL_LIMIT = 5;

/**
 * Failing audits kept per category.
 *
 * Fifteen is what the whole LHR used to get. Per category it is the same budget for
 * performance (its LHR reports nothing else) and a real widening for accessibility, which
 * was sharing fifteen rows with seo and best-practices and routinely showed six. The cost
 * is bounded: four categories, and a page bad enough to fill all four is a page whose
 * report should be long.
 */
const AUDITS_PER_CATEGORY = 15;

/**
 * Element crops attached across the whole result, and per audit.
 *
 * The worker caps how many pictures it *takes* (24 per run, 3 per audit), but a node can be
 * blamed by more than one audit — a button that fails both contrast and accessible-name —
 * and every detail row carries its own copy of the data URI. Without a second cap here,
 * one crop taken once could be stored a dozen times.
 *
 * Three per audit matches what the worker captures; twenty-four in total matches what it
 * took, so nothing is stored that was not worth taking.
 */
const SHOTS_PER_AUDIT = 3;
const SHOTS_PER_RESULT = 24;

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

export function extractAuditDetails(
  details: unknown,
  /** Cropped element pictures from the worker, keyed by Lighthouse node id. */
  shots?: Record<string, string>,
  /** Shared, mutable attachment budget — see SHOTS_PER_RESULT. */
  budget?: { left: number },
): AuditDetail[] | undefined {
  if (!details || typeof details !== 'object') return undefined;
  const items = (details as { items?: unknown[] }).items;
  if (!Array.isArray(items) || items.length === 0) return undefined;

  const out: AuditDetail[] = [];
  let attached = 0;
  for (const raw of items) {
    if (out.length >= AUDIT_DETAIL_LIMIT) break;
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const node = item['node'] as Record<string, unknown> | undefined;
    const lhId = typeof node?.['lhId'] === 'string' ? node['lhId'] as string : undefined;
    const canAttach = attached < SHOTS_PER_AUDIT && (!budget || budget.left > 0);
    const screenshot = lhId && canAttach ? shots?.[lhId] : undefined;
    if (screenshot) {
      attached++;
      if (budget) budget.left--;
    }

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
      ...(screenshot ? { screenshot } : {}),
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

/** Where an audit sits: which category reported it, and Lighthouse's own grouping inside it. */
export interface AuditPlacement {
  category: AnalysisCategory
  group?:   string
}

/**
 * `auditId → { category, group }`, read off the LHR's own category definitions.
 *
 * Nothing else in the pipeline knows which category an audit came from: `lhr.audits` is one
 * flat map, and the two LHRs we merge each carry all the audits their categories needed. The
 * answer is already in `categories[*].auditRefs`, with the group's display title one hop away
 * in `categoryGroups` — so this reads it rather than hard-coding a list that Lighthouse would
 * outgrow at the next release.
 *
 * First category wins for an audit referenced by two (a handful are), because the analyzer
 * shows each audit once and the first reference is the one whose score it counts toward.
 */
export function buildAuditPlacements(lhr: RunnerResult['lhr']): Map<string, AuditPlacement> {
  const placements = new Map<string, AuditPlacement>();
  const groups = (lhr as unknown as { categoryGroups?: Record<string, { title?: string }> }).categoryGroups ?? {};

  for (const key of ['performance', 'accessibility', 'best-practices', 'seo'] as const) {
    const refs = lhr.categories[key]?.auditRefs ?? [];
    for (const ref of refs) {
      if (placements.has(ref.id)) continue;
      const title = ref.group ? groups[ref.group]?.title : undefined;
      placements.set(ref.id, { category: key, ...(title ? { group: title } : {}) });
    }
  }
  return placements;
}

/**
 * Failing audits, capped **per category** rather than per LHR.
 *
 * One cap across the whole LHR is what made the accessibility list look short: the static
 * run reports seo, best-practices and accessibility together, so fifteen rows had to be
 * shared between three categories and whichever scored worst took nearly all of them. A
 * category is what a person filters by, so it is also the right thing to budget by.
 */
export function extractFailingAudits(
  audits: Record<string, { score?: number | null; title?: string; description?: string; displayValue?: string; details?: unknown }>,
  placements?: Map<string, AuditPlacement>,
  /** Cropped element pictures from the worker, keyed by Lighthouse node id. */
  shots?: Record<string, string>,
): AuditItem[] {
  const perCategory = new Map<string, number>();
  const shotBudget = { left: SHOTS_PER_RESULT };

  return Object.entries(audits)
    .filter(([, a]) => a.score !== null && (a.score ?? 1) < 0.9)
    .sort(([, a], [, b]) => (a.score ?? 1) - (b.score ?? 1))
    .filter(([id]) => {
      // An audit with no placement (an older LHR shape, or one no category references)
      // still counts against a bucket of its own rather than slipping past the cap.
      const key = placements?.get(id)?.category ?? 'unplaced';
      const used = perCategory.get(key) ?? 0;
      if (used >= AUDITS_PER_CATEGORY) return false;
      perCategory.set(key, used + 1);
      return true;
    })
    .map(([id, a]): AuditItem => {
      const details = extractAuditDetails(a.details, shots, shotBudget);
      const savings = extractSavings(a.details);
      const placement = placements?.get(id);
      return {
        id,
        title: a.title ?? id,
        description: a.description ?? '',
        score: a.score ?? null,
        displayValue: a.displayValue,
        impact: scoreToImpact(a.score ?? null),
        ...(placement ? { category: placement.category } : {}),
        ...(placement?.group ? { group: placement.group } : {}),
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
  const audits = extractFailingAudits(lhr.audits, buildAuditPlacements(lhr));

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
  /** Cropped element pictures, keyed by Lighthouse node id — only the static run produces
   *  them, and only when the caller asked for elements to be captured. */
  elementShots?: Record<string, string>,
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

    allAudits.push(...extractFailingAudits(lhr.audits, buildAuditPlacements(lhr), elementShots));
  }

  // Deduplicate audits by id, then order the merged list by how badly it scored.
  //
  // Concatenation order used to decide this, which meant the static run's seo and
  // best-practices findings came ahead of every performance opportunity no matter how bad
  // it was — visible to the reader as an odd default ordering, and to the AI as the first
  // fourteen it is given (`AUDIT_LIMIT` in pageContext). Worst first is the honest order
  // for both.
  const seen = new Set<string>();
  const uniqueAudits = allAudits
    .filter(({ id: auditId }) => (seen.has(auditId) ? false : (seen.add(auditId), true)))
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1));

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

    // Only the performance run carries `script-treemap-data` — it is that category's audit,
    // and the static group never runs it.
    const bundles = parseBundles(performanceLhr);
    if (bundles) result.bundles = bundles;

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
