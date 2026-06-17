import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { getHostname } from '@/entities/website';

interface Props { url: string }

export function HistoryEmptyState({ url }: Props) {
  const hostname = getHostname(url);

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
        <p className="text-sm font-semibold text-ps-body">
          No history found for this URL yet
        </p>
        <p className="text-[12px] text-ps-muted">
          Run an analysis on{' '}
          <span className="font-mono text-ps-accent">{hostname}</span>
          {' '}to start tracking performance over time.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs mt-1">
        <Link to="/app">← Back to Analyzer</Link>
      </Button>
    </motion.div>
  );
}
