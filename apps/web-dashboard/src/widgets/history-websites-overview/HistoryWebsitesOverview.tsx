import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import { Button } from '@/shared/ui/button';
import { useWebsites } from '@/features/dashboard/useWebsites';
import { HistoryWebsiteCard } from '@/widgets/history-website-card';

interface Props {
  allEntries: HistoryEntry[];
  isLoading:  boolean;
}

export function HistoryWebsitesOverview({ allEntries, isLoading }: Props) {
  const { websites } = useWebsites();

  const grouped = useMemo(() => {
    const map: Record<string, HistoryEntry[]> = {};
    for (const e of allEntries) {
      if (!map[e.url]) map[e.url] = [];
      map[e.url].push(e);
    }
    for (const url of Object.keys(map)) {
      map[url].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    return map;
  }, [allEntries]);

  const sitesWithHistory = useMemo(() =>
    websites
      .filter(s => grouped[s.url]?.length > 0)
      .sort((a, b) => {
        const la = grouped[a.url]?.at(-1)?.timestamp ?? '';
        const lb = grouped[b.url]?.at(-1)?.timestamp ?? '';
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
          <HistoryWebsiteCard
            siteUrl={site.url}
            siteName={site.name}
            entries={grouped[site.url]}
          />
        </motion.div>
      ))}
    </div>
  );
}
