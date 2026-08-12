import type { CompareEntry } from '@perfscope/shared';
import { CompareHistoryModel } from '../models/CompareHistory.model.js';
import { hostOf } from '../lib/url.js';

const MAX_PER_PAIR = 10;

export type { CompareEntry };

interface RawDoc {
  _id: unknown;
  pairId: string; sourceUrl: string; targetUrl: string;
  sourceHostname: string; targetHostname: string;
  source: CompareEntry['source']; competitor: CompareEntry['competitor'];
  winner: 'source' | 'competitor' | 'tie';
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
    timestamp:      ts,
  };
}

export const CompareHistoryService = {
  async save(
    userId: string,
    sourceUrl: string, targetUrl: string,
    source: CompareEntry['source'], competitor: CompareEntry['competitor'],
  ): Promise<void> {
    const pairId = makePairId(sourceUrl, targetUrl);
    await CompareHistoryModel.create({
      userId, pairId, sourceUrl, targetUrl,
      sourceHostname: hostname(sourceUrl),
      targetHostname: hostname(targetUrl),
      source, competitor,
      winner: determineWinner(source, competitor),
    });
    // Scoped to the owner as well: pruning by pairId alone would delete another account's
    // runs of the same two sites.
    const count = await CompareHistoryModel.countDocuments({ userId, pairId });
    if (count > MAX_PER_PAIR) {
      const oldest = await CompareHistoryModel
        .find({ userId, pairId }).sort({ createdAt: 1 }).limit(count - MAX_PER_PAIR).select('_id');
      await CompareHistoryModel.deleteMany({ _id: { $in: oldest.map(d => d._id) } });
    }
  },

  async getPair(userId: string, pairId: string): Promise<CompareEntry[]> {
    const docs = await CompareHistoryModel
      .find({ userId, pairId }).sort({ createdAt: 1 }).lean() as unknown as RawDoc[];
    return docs.map(toEntry);
  },

  async listPairs(userId: string, search?: string): Promise<CompareEntry[]> {
    const match: Record<string, unknown> = { userId };
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
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
