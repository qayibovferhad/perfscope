import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock } from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import { Button } from '@/shared/ui/button';
import { getHostname } from '@/entities/website';
import { useWebsites } from '@/features/dashboard/hooks/useWebsites';
import { hasResult } from '@/features/history/lib/hasResult';
import { HistoryEvolutionCard } from '@/features/history/ui/HistoryEvolutionCard';

interface Props {
  allEntries: HistoryEntry[];
  isLoading:  boolean;
}

export function HistoryWebsitesOverview({ allEntries, isLoading }: Props) {
  const { websites } = useWebsites();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-28">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(139,92,246,0.18)', borderTopColor: 'var(--ps-accent)' }}
        />
      </div>
    );
  }

  if (sitesWithHistory.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 py-24 text-center"
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-ps-accent-muted border border-ps-accent-border">
          <Clock className="w-7 h-7 text-ps-accent opacity-70" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ps-body">No history yet</p>
          <p className="text-[12px] text-ps-muted">
            Run an analysis to start tracking performance over time.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs mt-1">
          <Link to="/app">Go to Analyzer</Link>
        </Button>
      </motion.div>
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
