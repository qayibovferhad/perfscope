import { createHash } from 'node:crypto';
import { AiRecommendationModel } from '../models/AiRecommendation.model.js';
import type { AnalysisResult } from '@perfscope/shared';

/**
 * What `analysePage` sees about a fix it (or an earlier audit) already gave for this page.
 * `resolved` means the fingerprint that used to appear in this page's fixes does not
 * anymore — the diagnosis can lead with "that got fixed" instead of staying silent.
 */
export interface RecommendationHistoryEntry {
  fix:        string;
  timesGiven: number;
  resolved:   boolean;
}

/**
 * Two audits phrase the same finding differently every time — "Trim unused JavaScript
 * from pubads_impl.js" one run, "Eliminate unused JS in pubads_impl.js" the next — so
 * fingerprinting on the sentence itself never matches twice. What stays stable is the
 * concrete thing being cited: a filename, a generated class name, a vendor hostname.
 * Phase 1 put those into every fix that has one; this keys off them. A fix with no such
 * identifier (rare, now that audits carry evidence) falls back to a normalised bag of its
 * significant words, which still catches a fix repeated near-verbatim.
 */
export function extractIdentifiers(text: string): string[] {
  const out = new Set<string>();

  // Filenames and hostnames: "pubads_impl.js", "bbci.co.uk", "cdn.permutive.com".
  for (const m of text.matchAll(/\b[\w-]+(?:\.[\w-]+)+\b/g)) {
    if (m[0].length >= 6) out.add(m[0].toLowerCase());
  }
  // Generated/component class names: "Image-styles__ImageStyled-sc-8c99a12b-0".
  for (const m of text.matchAll(/\b[a-zA-Z][\w]*(?:-[a-zA-Z0-9]+){2,}\b/g)) {
    if (m[0].length >= 10) out.add(m[0].toLowerCase());
  }
  return [...out];
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'to', 'from', 'your', 'you', 'and', 'or', 'of', 'in', 'on', 'for',
  'with', 'that', 'this', 'is', 'are', 'by', 'into', 'so', 'it', 'its', 'so', 'which',
]);

function normalizedWordSignature(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(kb|mb|ms|s|elements?|requests?|bytes?)\b/g, '')
    .replace(/[^a-z0-9._/-]+/g, ' ')
    .split(' ')
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .sort()
    .join(' ')
    .trim();
}

export function fingerprintFix(fix: string): string {
  const identifiers = extractIdentifiers(fix);
  const key = identifiers.length > 0 ? identifiers.sort().join('|') : normalizedWordSignature(fix);
  return createHash('sha256').update(key).digest('hex').slice(0, 24);
}

/**
 * Every identifier this run's audit surfaced anywhere on the page — not just in the
 * headline fixes. The model picks 3-6 fixes to lead with each run and the selection
 * varies; an audit that didn't make this run's cut is not the same as an audit that
 * passed. Used to gate resolution: only stop tracking a recommendation once none of its
 * identifiers turn up here, not merely once it drops out of `analysis.fixes`.
 */
export function buildPageIdentifiers(result: AnalysisResult): Set<string> {
  const parts: string[] = [];
  for (const a of result.audits) {
    parts.push(a.id, a.title, a.displayValue ?? '');
    for (const d of a.details ?? []) parts.push(d.selector ?? '', d.snippet ?? '', d.url ?? '', d.value ?? '');
  }
  for (const r of result.resources?.requests ?? []) parts.push(r.url);
  for (const t of result.thirdParty ?? []) parts.push(t.name);
  for (const l of result.resources?.detectedLibraries ?? []) parts.push(l.name);
  for (const e of result.flameChartData?.events ?? []) if (e.url) parts.push(e.url);
  for (const e of result.clsData?.elements ?? []) parts.push(e.selector);
  return new Set(extractIdentifiers(parts.join(' ')));
}

/** What this page's fixes look like so far, for `analysePage` to read before it writes new ones. */
export async function getRecommendationHistory(
  userId: string,
  url: string,
): Promise<RecommendationHistoryEntry[]> {
  const rows = await AiRecommendationModel
    .find({ userId, url })
    .sort({ lastSeenAt: -1 })
    .limit(20)
    .lean();

  return rows.map(r => ({
    fix:        r.fixText,
    timesGiven: r.timesGiven,
    resolved:   r.resolvedAt !== null,
  }));
}

/**
 * Folds this run's fixes into the recommendation history: bumps `timesGiven` for ones
 * seen before (un-resolving them if they had been marked fixed — a regression, not
 * a one-off), creates rows for new ones, and resolves a previously-open row only when
 * NONE of its identifiers turn up anywhere in this run's fresh evidence — see
 * `buildPageIdentifiers`. Falling out of the headline fixes is not the same as the
 * underlying audit passing, and a wrong "this is fixed" is worse than staying silent.
 *
 * Never throws — called after the audit's real work is done; a tracking failure here
 * should not be why an audit fails.
 */
export async function reconcileRecommendations(
  userId: string,
  result: AnalysisResult,
  fixes: string[],
): Promise<void> {
  try {
    const now = new Date();
    const url = result.url;
    const pageIdentifiers = buildPageIdentifiers(result);

    const fixMeta = fixes.map(fix => ({
      fix,
      fingerprint: fingerprintFix(fix),
      identifiers: extractIdentifiers(fix),
    }));
    const seenThisRun = new Set(fixMeta.map(f => f.fingerprint));

    await Promise.all(fixMeta.map(({ fix, fingerprint, identifiers }) =>
      AiRecommendationModel.updateOne(
        { userId, url, fingerprint },
        {
          $set: { fixText: fix, lastSeenAt: now, resolvedAt: null, identifiers },
          $setOnInsert: { firstSeenAt: now },
          $inc: { timesGiven: 1 },
        },
        { upsert: true },
      )
    ));

    const stillOpen = await AiRecommendationModel.find({ userId, url, resolvedAt: null }).lean();
    const toResolve = stillOpen
      .filter(r => !seenThisRun.has(r.fingerprint))
      .filter(r => !r.identifiers.some(id => pageIdentifiers.has(id)))
      .map(r => r._id);

    if (toResolve.length > 0) {
      await AiRecommendationModel.updateMany(
        { _id: { $in: toResolve } },
        { $set: { resolvedAt: now } },
      );
    }
  } catch (err: unknown) {
    console.warn('[AI] Recommendation tracking failed:', err);
  }
}
