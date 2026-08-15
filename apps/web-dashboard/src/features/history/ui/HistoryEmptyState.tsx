import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { StatePanel } from '@/shared/ui/state-panel';
import { getHostname } from '@/entities/website';

interface Props { url: string }

export function HistoryEmptyState({ url }: Props) {
  const hostname = getHostname(url);

  return (
    <StatePanel
      icon={<Clock className="w-6 h-6" />}
      title="No history found for this URL yet"
      description={
        <>
          Run an analysis on{' '}
          <span className="font-mono text-ld-accent">{hostname}</span>
          {' '}to start tracking performance over time.
        </>
      }
      action={
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link to="/app">← Back to Analyzer</Link>
        </Button>
      }
    />
  );
}
