/**
 * Evidence-bearing facts about one side of a comparison — the same instinct as
 * `ai.service.ts`'s `buildPageContext` (name the file/vendor, not just the number), sized
 * for a 2-3 sentence verdict rather than a full diagnosis: the worst failing audits, the
 * heaviest resource, the top-blocking vendor. Nothing here is a fresh Gemini call; it is
 * plain string-building over data the caller already has.
 */
import type { AnalysisResult } from '@perfscope/shared';
import { pathOf } from './url.js';

const short = (url?: string): string => url ? pathOf(url, url) : '';

/**
 * Up to three short, concrete facts, ranked so a real performance cause outranks a merely
 * concrete one. A `savingsMs` audit (an "opportunity" — render-blocking JS, unused code,
 * an oversized resource) is why a page is actually SLOW; a DOM audit with a selector
 * (missing alt text, a contrast ratio) is concrete but usually irrelevant to a speed gap.
 *
 * Exported as a list, not a joined string, because `getCompareVerdict` uses these two ways:
 * as the "Evidence" line the model reads, and as the closed set a "cause" it names is
 * checked against afterward — the model may not always connect a real cause to the gap
 * correctly on its own (measured live: asked for a cause without one, it invented a
 * plausible-sounding but entirely fictional one — "a missing charset declaration" — more
 * than once), so the caller decides the citation, not the model's free text.
 */
export function citableFacts(result: AnalysisResult): string[] {
  const facts: string[] = [];

  const evidenceRank = (a: AnalysisResult['audits'][number]) =>
    a.savingsMs ? 2 : a.details?.[0] ? 1 : 0;
  const failing = [...result.audits]
    .filter(a => (a.score ?? 1) < 1)
    .sort((a, b) => evidenceRank(b) - evidenceRank(a))
    .slice(0, 3);
  for (const a of failing) {
    const d = a.details?.[0];
    const detail = d?.selector || d?.url || d?.snippet || d?.value;
    const savings = a.savingsMs ? `~${Math.round(a.savingsMs)}ms` : null;
    const suffix = [detail, savings].filter(Boolean).join(', ');
    facts.push(suffix ? `${a.title} (${suffix})` : a.title);
  }

  const heaviest = [...(result.resources?.requests ?? [])]
    .sort((a, b) => b.transferSize - a.transferSize)[0];
  if (heaviest) facts.push(`heaviest resource: ${short(heaviest.url)} (${Math.round(heaviest.transferSize / 1024)}KB)`);

  const topVendor = [...(result.thirdParty ?? [])]
    .sort((a, b) => b.blockingTime - a.blockingTime)[0];
  if (topVendor && topVendor.blockingTime > 0) facts.push(`top vendor: ${topVendor.name} (${Math.round(topVendor.blockingTime)}ms blocking)`);

  return facts;
}
