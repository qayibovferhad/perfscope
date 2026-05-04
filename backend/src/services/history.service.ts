import { HistoryModel } from '../models/History.model.js';

const MAX_PER_URL = 10;

export interface HistoryEntry {
  id:        string;
  shortId:   string;
  url:       string;
  timestamp: string;
  scores: {
    performance:   number;
    accessibility: number;
    bestPractices: number;
    seo:           number;
  };
  metrics: {
    fcp: number;
    lcp: number;
    tbt: number;
    cls: number;
    si:  number;
    tti: number;
  };
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export const HistoryService = {
  async save(entry: HistoryEntry): Promise<void> {
    const normalizedUrl = normalizeUrl(entry.url);
    console.log(normalizedUrl,'normalizedUrl');
    
    await HistoryModel.create({
      analysisId:    entry.id,
      shortId:       entry.shortId,
      url:           entry.url,
      normalizedUrl,
      scores:        entry.scores,
      metrics:       entry.metrics,
    });

    // Keep only latest MAX_PER_URL per URL — delete oldest extras
    const count = await HistoryModel.countDocuments({ normalizedUrl });
    if (count > MAX_PER_URL) {
      const oldest = await HistoryModel
        .find({ normalizedUrl })
        .sort({ createdAt: 1 })
        .limit(count - MAX_PER_URL)
        .select('_id');
      await HistoryModel.deleteMany({ _id: { $in: oldest.map(d => d._id) } });
    }
  },

  async get(url: string): Promise<HistoryEntry[]> {
    const docs = await HistoryModel
      .find({ normalizedUrl: normalizeUrl(url) })
      .sort({ createdAt: 1 })   // oldest → newest for trend chart
      .lean();

    return docs.map(d => ({
      id:        d.analysisId,
      shortId:   d.shortId,
      url:       d.url,
      timestamp: (d.createdAt as Date).toISOString(),
      scores:    d.scores,
      metrics:   d.metrics,
    }));
  },
};
