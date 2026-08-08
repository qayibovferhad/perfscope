import type { HistoryEntry } from '@/entities/history';
import { HistoryPageHeader } from './HistoryPageHeader';
import { EvolutionChartPanel } from './EvolutionChartPanel';

interface Props {
  url:     string;
  entries: HistoryEntry[];
  /** Right-hand footer slot. Defaults to the regression threshold note. */
  action?: React.ReactNode;
}

/**
 * The one card that presents a site's audit history: header + CWV strip + evolution
 * chart + footer.
 *
 * Both the history overview list and the per-URL drill-down render this, so they cannot
 * drift apart again — they previously carried two separate headers, two hand-rolled
 * legends and two token families for what is the same information.
 */
export function HistoryEvolutionCard({ url, entries, action }: Props) {
  const last = entries.at(-1);
  if (!last) return null;

  return (
    <div className="rounded-[20px] border border-ld-border bg-ld-surface overflow-hidden shadow-ld-shadow-card">
      <HistoryPageHeader url={url} entries={entries} />
      <EvolutionChartPanel entries={entries} />

      <div className="flex items-center justify-between px-[24px] py-[14px] border-t border-ld-border bg-ld-surface-2 flex-wrap gap-[12px]">
        <span className="font-mono text-[12.5px] text-ld-text-3">
          Last run: {new Date(last.timestamp).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
        {action ?? (
          <span className="font-mono text-[11px] text-ld-text-3 opacity-60">
            Regression threshold: &gt;15% degradation vs previous run
          </span>
        )}
      </div>
    </div>
  );
}
