import type { AnalysisResult, CompareEntry } from '@perfscope/shared';
import { CompareHistoryModel } from '../models/CompareHistory.model.js';
import { HistoryModel } from '../models/History.model.js';
import { escapeRegex, hostOf } from '../lib/url.js';
import { pruneToLimit } from '../lib/mongo.js';
import { citableFacts } from '../lib/compareVerdictEvidence.js';
import { AiService } from './ai.service.js';

/**
 * Best-effort: the id is only sent when the side actually came from a live socket run
 * (see `ComparisonPage.tsx`'s `askSubjects` for the same "live, not uploaded" gate). Even
 * then, `persistAudit` is fire-and-forget in the socket handler, and this save fires the
 * instant both sides report `success` — the same tick, not after the write. Measured live:
 * a real run's `History` row landed ~2s *after* this had already looked for it. One short
 * retry closes that gap without ever blocking the save on it for long; still a genuine
 * miss (upload/preload, or an unusually slow write) just falls back to numbers-only, same
 * as it always did.
 */
async function factsFor(userId: string, analysisId?: string | null): Promise<string[]> {
  if (!analysisId) return [];
  for (const delayMs of [0, 2500]) {
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    const doc = await HistoryModel.findOne({ analysisId, userId }).select('fullResult').lean().catch(() => null);
    if (doc?.fullResult) return citableFacts(doc.fullResult as unknown as AnalysisResult);
  }
  return [];
}

const MAX_PER_PAIR = 10;

export type { CompareEntry };

interface RawDoc {
  _id: unknown;
  pairId: string; sourceUrl: string; targetUrl: string;
  sourceHostname: string; targetHostname: string;
  source: CompareEntry['source']; competitor: CompareEntry['competitor'];
  winner: 'source' | 'competitor' | 'tie';
  aiVerdict?: string;
  createdAt: unknown;
}

/** Host for display and the pairId key. Falls back to the raw string — pairIds derived
 *  from unparseable input must keep matching the ones already stored. */
function hostname(url: string): string {
  return hostOf(url) || url;
}

function makePairId(url1: string, url2: string): string {
  return [hostname(url1), hostname(url2)].sort().join('-vs-');
}

function determineWinner(
  source: { scores: Record<string, number> },
  competitor: { scores: Record<string, number> },
): 'source' | 'competitor' | 'tie' {
  const s = source.scores['performance'] ?? 0;
  const c = competitor.scores['performance'] ?? 0;
  if (s > c + 1) return 'source';
  if (c > s + 1) return 'competitor';
  return 'tie';
}

function toEntry(d: RawDoc): CompareEntry {
  const ts = d.createdAt instanceof Date
    ? d.createdAt.toISOString()
    : new Date(String(d.createdAt)).toISOString();
  return {
    id:             String(d._id),
    pairId:         d.pairId,
    sourceUrl:      d.sourceUrl,
    targetUrl:      d.targetUrl,
    sourceHostname: d.sourceHostname,
    targetHostname: d.targetHostname,
    source:         d.source,
    competitor:     d.competitor,
    winner:         d.winner,
    ...(d.aiVerdict ? { aiVerdict: d.aiVerdict } : {}),
    timestamp:      ts,
  };
}

export const CompareHistoryService = {
  async save(
    userId: string,
    sourceUrl: string, targetUrl: string,
    source: CompareEntry['source'], competitor: CompareEntry['competitor'],
    sourceAnalysisId?: string | null, competitorAnalysisId?: string | null,
  ): Promise<string | null> {
    const pairId = makePairId(sourceUrl, targetUrl);

    const [sourceFacts, competitorFacts] = await Promise.all([
      factsFor(userId, sourceAnalysisId),
      factsFor(userId, competitorAnalysisId),
    ]);

    // Generated here rather than on the page, because this is the one moment both sides
    // exist server-side. A failure costs the sentence, never the saved comparison.
    const aiVerdict = await AiService
      .getCompareVerdict({ sourceUrl, targetUrl, source, competitor, sourceFacts, competitorFacts })
      .catch((err: unknown) => {
        console.error('[AI] Compare verdict failed:', err);
        return null;
      });

    await CompareHistoryModel.create({
      userId, pairId, sourceUrl, targetUrl,
      sourceHostname: hostname(sourceUrl),
      targetHostname: hostname(targetUrl),
      source, competitor,
      winner: determineWinner(source, competitor),
      ...(aiVerdict ? { aiVerdict } : {}),
    });
    // Scoped to the owner as well: pruning by pairId alone would delete another account's
    // runs of the same two sites.
    await pruneToLimit(CompareHistoryModel, { userId, pairId }, MAX_PER_PAIR);
    return aiVerdict;
  },

  async getPair(userId: string, pairId: string): Promise<CompareEntry[]> {
    const docs = await CompareHistoryModel
      .find({ userId, pairId }).sort({ createdAt: 1 }).lean() as unknown as RawDoc[];
    return docs.map(toEntry);
  },

  async listPairs(userId: string, search?: string): Promise<CompareEntry[]> {
    const match: Record<string, unknown> = { userId };
    if (search) {
      const re = new RegExp(escapeRegex(search), 'i');
      match['$or'] = [{ sourceHostname: re }, { targetHostname: re }];
    }
    const docs = await CompareHistoryModel.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$pairId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { createdAt: -1 } },
    ]) as unknown as RawDoc[];
    return docs.map(toEntry);
  },
};
