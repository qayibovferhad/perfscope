import { useMemo }         from 'react';
import { useAllHistory }  from '@/features/history/model/useHistory';
import type { HistoryEntry } from '@/entities/history';

export interface SiteScoreInfo {
  latestScore:   number | null;
  recentScores:  number[];
  lastAuditedAt: string | null;
}

/**
 * A run that failed (unreachable host, Chrome crash, timeout) is still persisted,
 * but with every score and metric at 0. Those carry no signal, so they must not
 * be reported as a score of 0 — a real page always moves at least one of these.
 */
function hasResult(entry: HistoryEntry): boolean {
  const { performance, accessibility, bestPractices, seo } = entry.scores;
  if (performance || accessibility || bestPractices || seo) return true;

  const { fcp, lcp, tbt, cls, si, tti } = entry.metrics;
  return Boolean(fcp || lcp || tbt || cls || si || tti);
}

export function useWebsiteScores() {
  const { data: entries = [], isLoading } = useAllHistory();

  const byUrl = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const e of entries) {
      if (!hasResult(e)) continue;
      if (!map.has(e.url)) map.set(e.url, []);
      map.get(e.url)!.push(e);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    return map;
  }, [entries]);

  function getInfo(url: string): SiteScoreInfo {
    const list = byUrl.get(url) ?? [];
    if (!list.length) return { latestScore: null, recentScores: [], lastAuditedAt: null };
    const latest = list[list.length - 1];
    return {
      latestScore:   Math.round(latest.scores.performance),
      recentScores:  list.slice(-6).map(e => Math.round(e.scores.performance)),
      lastAuditedAt: latest.timestamp,
    };
  }

  return { getInfo, isLoading };
}
