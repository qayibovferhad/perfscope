import { Link } from 'react-router-dom';
import { History, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { OverviewAudit } from '@perfscope/shared';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { cn } from '@/shared/lib/utils';
import { timeAgo } from '@/shared/lib/time';
import { scoreBand } from '@/entities/analysis';

const BAND_TONE = {
  good: 'text-ld-accent',
  warn: 'text-ld-amber',
  poor: 'text-ld-rose',
} as const;

/**
 * The delta is against the run immediately before this one on the same URL — not
 * against a per-site baseline, which would turn a flat history into a fake trend.
 * A first run has nothing to compare with and says so rather than showing 0.
 */
function Delta({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="font-mono text-[11.5px] text-ld-text-3">first run</span>;
  }
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-[4px] font-mono text-[11.5px] text-ld-text-3">
        <Minus className="w-[12px] h-[12px]" />0
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-[4px] font-mono text-[11.5px] font-semibold ${up ? 'text-ld-accent' : 'text-ld-rose'}`}>
      {up ? <ArrowUpRight className="w-[12px] h-[12px]" /> : <ArrowDownRight className="w-[12px] h-[12px]" />}
      {up ? '+' : ''}{delta}
    </span>
  );
}

export function RecentAuditsCard({ audits, className }: { audits: OverviewAudit[]; className?: string }) {
  return (
    <Panel className={cn('flex flex-col', className)}>
      <PanelHeader icon={<History />} title="Recent audits" meta={audits.length ? undefined : 'nothing yet'}>
        <Link
          to="/history"
          className="text-[12px] font-semibold text-ld-text-3 transition-colors duration-150 hover:text-ld-accent"
        >
          All history
        </Link>
      </PanelHeader>

      {!audits.length ? (
        <PanelBody>
          <p className="text-[13px] text-ld-text-2 leading-[1.55]">
            No audits yet —{' '}
            <Link to="/app" className="font-semibold text-ld-accent hover:underline">run one</Link>
            {' '}and it will appear here.
          </p>
        </PanelBody>
      ) : (
        // Rows run edge to edge on purpose: the dividers should reach the panel border
        // rather than stopping short, so the list reads as one column instead of
        // floating cards. Horizontal breathing room comes from the row padding.
        <ul className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {audits.map((audit, i) => (
            <li
              key={audit.id}
              className={`flex items-center gap-[14px] px-[18px] py-[13px] transition-colors duration-150 hover:bg-ld-surface-hover ${
                i < audits.length - 1 ? 'border-b border-ld-border' : ''
              }`}
            >
              <span className={`font-mono text-[18px] font-semibold tabular-nums w-[32px] shrink-0 ${BAND_TONE[scoreBand(audit.score)]}`}>
                {audit.score}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[12.5px] font-medium text-ld-text truncate">{audit.url}</b>
                <span className="block text-[11.5px] text-ld-text-3 mt-[2px]">{timeAgo(audit.at)}</span>
              </span>
              <span className="shrink-0">
                <Delta delta={audit.delta} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
