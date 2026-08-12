import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock } from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import { Button } from '@/shared/ui/button';
import { QueryErrorPanel, StatePanel } from '@/shared/ui/state-panel';
import { getHostname } from '@/entities/website';
import { useWebsites } from '@/entities/website';
import { hasResult } from '@/entities/history';
import { HistoryEvolutionCard } from '@/features/history/ui/HistoryEvolutionCard';

interface Props {
  allEntries: HistoryEntry[];
  isLoading:  boolean;
  isError?:   boolean;
  onRetry?:   () => void;
}

export function HistoryWebsitesOverview({ allEntries, isLoading, isError, onRetry }: Props) {
  // This list is the intersection of two requests, so it cannot be judged empty until both
  // have landed. Gating only on the history query let /websites resolve second and render
  // "No history yet" for a moment before swapping to content.
  const { websites, isLoading: sitesLoading } = useWebsites();

  // Keyed by hostname, not by full URL. Audits run per route, so a site saved as
  // "https://x.com" is audited as "https://x.com/" or "https://x.com/requests" — keying
  // on the exact URL left such a site out of this list entirely.
  const grouped = useMemo(() => {
    const map: Record<string, HistoryEntry[]> = {};
    for (const e of allEntries) {
      if (!hasResult(e)) continue;
      const host = getHostname(e.url, '');
      if (!host) continue;
      if (!map[host]) map[host] = [];
      map[host]!.push(e);
    }
    for (const host of Object.keys(map)) {
      map[host]!.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    return map;
  }, [allEntries]);

  const sitesWithHistory = useMemo(() =>
    websites
      .filter(s => (grouped[getHostname(s.url, '')]?.length ?? 0) > 0)
      .sort((a, b) => {
        const la = grouped[getHostname(a.url, '')]?.at(-1)?.timestamp ?? '';
        const lb = grouped[getHostname(b.url, '')]?.at(-1)?.timestamp ?? '';
        return lb.localeCompare(la);
      }),
  [websites, grouped]);

  if (isLoading || sitesLoading) {
    return (
      <div className="flex items-center justify-center py-28">
        <div className="w-6 h-6 rounded-full border-2 border-ld-border-strong border-t-ld-accent animate-spin" />
      </div>
    );
  }

  if (isError) {
    return <QueryErrorPanel what="audit history" {...(onRetry ? { onRetry } : {})} />;
  }

  if (sitesWithHistory.length === 0) {
    return (
      <StatePanel
        icon={<Clock className="w-7 h-7" />}
        title="No history yet"
        description="Run an analysis to start tracking performance over time."
        action={
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <Link to="/app">Go to Analyzer</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sitesWithHistory.map((site, i) => (
        <motion.div
          key={site._id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          <HistoryEvolutionCard
            url={site.url}
            entries={grouped[getHostname(site.url, '')]!}
            action={
              <Button variant="outline" size="md" asChild>
                <Link to={`/history?url=${encodeURIComponent(site.url)}`}>
                  View Details <ArrowRight />
                </Link>
              </Button>
            }
          />
        </motion.div>
      ))}
    </div>
  );
}
