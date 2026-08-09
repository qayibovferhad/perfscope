import { useMemo }         from 'react';
import { useAllHistory, hasResult, type HistoryEntry } from '@/entities/history';
import { getHostname }    from '@/entities/website';

export interface SiteScoreInfo {
  /** Mean performance across every successful audit of the site — the same figure the
   *  project detail page shows as "Avg Score" and the summary strip averages. */
  avgScore:      number | null;
  recentScores:  number[];
  lastAuditedAt: string | null;
}

export function useWebsiteScores() {
  const { data: entries = [], isLoading } = useAllHistory();

  // Keyed by hostname, not by full URL: audits are recorded per route, so a site saved
  // as "https://x.com" is audited as "https://x.com/" or "https://x.com/requests".
  // Matching exactly would leave every such site looking unaudited.
  const byHost = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const e of entries) {
      if (!hasResult(e)) continue;
      const host = getHostname(e.url, '');
      if (!host) continue;
      if (!map.has(host)) map.set(host, []);
      map.get(host)!.push(e);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    return map;
  }, [entries]);

  function getInfo(url: string): SiteScoreInfo {
    const list = byHost.get(getHostname(url, '')) ?? [];
    if (!list.length) return { avgScore: null, recentScores: [], lastAuditedAt: null };

    const latest = list[list.length - 1]!;
    const runs   = list.map(e => e.scores.performance);

    return {
      // Rounded once at the end, matching how the server computes it — rounding each run
      // first would drift the two apart by a point.
      avgScore:      Math.round(runs.reduce((sum, s) => sum + s, 0) / runs.length),
      recentScores:  list.slice(-6).map(e => Math.round(e.scores.performance)),
      lastAuditedAt: latest.timestamp,
    };
  }

  return { getInfo, isLoading };
}
