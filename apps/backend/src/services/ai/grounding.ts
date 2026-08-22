/**
 * The hallucination guard: does a generated sentence cite evidence the audit actually
 * contains? Self-contained — its only sibling dependency is the Gemini client, and only
 * for the one correction call `critiqueTexts` makes when something is flagged.
 */
import type { AnalysisResult } from '@perfscope/shared';
import { extractIdentifiers } from '../aiRecommendation.service.js';
import { generate, parseJson, VOICE } from './client.js';

/**
 * Everything a fix could legitimately cite by name — filenames, libraries, CLS
 * selectors, long-task functions, vendors, audit-detail selectors. The same evidence
 * `probes/ai-quality.probe.mts` builds to *score* concreteness after the fact; here it
 * gates `findUngroundedTexts` *before* a claim ever reaches the reader.
 */
export function buildEvidenceSet(result: AnalysisResult): Set<string> {
  const tail = (s: string) => (s.split('/').pop()?.split('?')[0] ?? '').toLowerCase();
  const evidence = new Set<string>();
  for (const q of result.resources?.requests ?? [])   { try { evidence.add(tail(new URL(q.url).pathname)); } catch { /* skip */ } }
  for (const l of result.resources?.detectedLibraries ?? []) evidence.add(l.name.toLowerCase());
  for (const e of result.clsData?.elements ?? [])      evidence.add((e.selector.split(' > ').pop() ?? '').toLowerCase());
  for (const e of result.flameChartData?.events ?? []) if (e.isLongTask && e.url) evidence.add(tail(e.url));
  for (const t of result.thirdParty ?? [])             evidence.add(t.name.toLowerCase());
  for (const a of result.audits) for (const d of a.details ?? [])
    if (d.selector) evidence.add((d.selector.split(' > ').pop() ?? '').toLowerCase());
  return evidence;
}

/**
 * A text "cites" something specific when it contains a filename or a generated-class
 * style identifier (the same extractor phase 2's recommendation fingerprinting uses —
 * `extractIdentifiers`). Flagged when NONE of its identifiers appear anywhere in the
 * evidence this audit actually contains: a plausible-sounding filename or selector that
 * was never in the data is a hallucination, not a paraphrase. A text with no
 * specific-looking claim at all is never flagged — "improve your heading hierarchy"
 * isn't citing anything, so there's nothing to verify, and generic-but-true advice
 * shouldn't be punished for being generic.
 *
 * Each item is keyed so a correction can be mapped back to exactly where it came from —
 * `diagnosis`, `fix:2`, `audit:unused-javascript`. Generalised from the fixes-only
 * version this replaced: a hallucinated filename is exactly as misleading sitting in
 * the diagnosis sentence or a per-audit explanation as it is in a fix.
 */
export function findUngroundedTexts(
  items: { key: string; text: string }[], evidence: Set<string>,
): { key: string; text: string }[] {
  return items.filter(({ text }) => {
    const identifiers = extractIdentifiers(text);
    if (identifiers.length === 0) return false;
    return !identifiers.some(id => [...evidence].some(e => e.includes(id) || id.includes(e)));
  });
}

/**
 * The escalation path — one extra Gemini call covering every flagged item together
 * (the diagnosis, any fixes, any per-audit explanations), and only when
 * `findUngroundedTexts` actually found something to check. Most audits never trigger
 * this: it costs nothing on the common path, and is the thing that catches an invented
 * filename before a reader does. Never throws; a failed critique just leaves the
 * original text in place — a plausible-but-unverified claim reaching the reader is the
 * existing risk, not a new one this introduces.
 */
export async function critiqueTexts(
  flagged: { key: string; text: string }[], evidence: Set<string>,
): Promise<Map<string, string>> {
  const corrections = new Map<string, string>();
  if (flagged.length === 0) return corrections;

  const prompt = `You wrote this analysis of a Lighthouse audit. Each keyed line below cites a file, class or element name that does not appear anywhere in this audit's actual evidence — check each and correct it.

${VOICE}

Evidence this audit actually contains (filenames, selectors, vendor and library names):
${[...evidence].slice(0, 60).join(', ') || '(none)'}

Lines to check:
${flagged.map(f => `${f.key}: ${f.text}`).join('\n')}

For each: if the name it cites is not in the evidence above, either rewrite it to cite something that IS there, or drop the specific claim and describe it in general terms instead. Do not invent a replacement name that also isn't in the evidence, and do not add any other specific number or detail that isn't already in the original sentence or the evidence above — fix only what was wrong, don't embellish the rest.

Answer ONLY with JSON: {"corrected": {${flagged.map(f => `"${f.key}": string`).join(', ')}}}`;

  const parsed = await generate(prompt, { json: true, label: 'text critique' })
    .then(raw => parseJson<{ corrected?: Record<string, unknown> }>(raw, 'text critique'))
    .catch((err: unknown) => { console.error('[AI] Text critique failed:', err); return null; });
  if (!parsed?.corrected) return corrections;

  for (const f of flagged) {
    const fixed = parsed.corrected[f.key];
    if (typeof fixed === 'string' && fixed.trim()) corrections.set(f.key, fixed.trim().slice(0, 300));
  }
  return corrections;
}
