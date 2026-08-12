import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { RouteGroup, ProjectAuditEntry } from '@/entities/history';
import { AuditRow }  from './AuditRow';
import { timeAgo }   from '../lib/formatters';
import { ScoreRing } from '@/entities/analysis';
import { Sparkline } from '@/shared/ui/chart';

// ─── Route group card ─────────────────────────────────────────────────────────

export function RouteGroupCard({
  group, projectId, compareMode, selectedIds, onToggleSelect, onOpen, loadingId, initialOpen = false,
}: {
  group: RouteGroup;
  projectId: string;
  compareMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (entry: ProjectAuditEntry) => void;
  onOpen: (entry: ProjectAuditEntry) => void;
  loadingId: string | null;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(compareMode || initialOpen);
  const navigate   = useNavigate();
  const isOpen     = compareMode ? true : open;
  const lastEntry  = group.entries.at(-1);
  const auditLabel = `${group.entries.length} audit${group.entries.length !== 1 ? 's' : ''} · last ${timeAgo(lastEntry?.timestamp ?? null)}`;

  // Re-auditing is a property of the route, not of one past run — every row used
  // to carry its own button even though they all audited the same URL.
  function handleAnalyze() {
    if (!lastEntry) return;
    navigate(`/app?url=${encodeURIComponent(lastEntry.url)}&projectId=${projectId}`);
  }

  return (
    <div className={`rounded-[16px] border bg-ld-surface overflow-hidden transition-[border-color] duration-[250ms] ${isOpen ? 'border-ld-accent-line' : 'border-ld-border'}`}>

      {/* Route row — the expander and the action are siblings, never nested buttons */}
      <div className={`flex items-center gap-[13px] pr-[16px] transition-[background] duration-[180ms] ${isOpen ? '' : 'hover:bg-ld-surface-2'}`}>
        <button
          className="flex-1 min-w-0 flex items-center gap-[13px] px-[20px] py-[16px] cursor-pointer bg-transparent border-none text-left"
          onClick={() => !compareMode && setOpen(v => !v)}
          aria-expanded={isOpen}
        >
          <span className={`w-[22px] h-[22px] shrink-0 grid place-items-center transition-[transform,color] duration-[280ms] ${isOpen ? 'rotate-90 text-ld-accent' : 'text-ld-text-3'}`}>
            <ChevronRight className="w-[16px] h-[16px]" />
          </span>

          <span className="w-[38px] h-[38px] rounded-[11px] shrink-0 grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent">
            <LinkIcon className="w-[18px] h-[18px]" />
          </span>

          <span className="flex-1 min-w-0 text-left">
            <b className="block font-mono text-[15px] font-semibold text-ld-text truncate">
              {group.routePath}
            </b>
            <span className="block text-[12px] text-ld-text-3 mt-[2px]">{auditLabel}</span>
          </span>

          <Sparkline
            values={group.entries.slice(-6).map(e => e.scores.performance)}
            id={`route-${group.routePath}`}
          />
          <ScoreRing score={group.lastScore} size={44} />
        </button>

        {!compareMode && lastEntry && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-[7px]"
            title={`Run a new audit of ${group.routePath}`}
            onClick={handleAnalyze}
          >
            <RefreshCw className="w-[14px] h-[14px]" />
            Analyze
          </Button>
        )}
      </div>

      {/* Collapsible body — CSS max-height toggle, no JS measurement */}
      <div
        className={`overflow-hidden transition-[max-height] duration-[350ms] ease-in-out ${isOpen ? 'max-h-[1000px]' : 'max-h-0'}`}
      >
        <div className="px-[20px] pb-[18px] pt-[4px] border-t border-ld-border">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {compareMode && (
                  <th className="py-[12px] px-[10px] pb-[10px] w-8 border-b border-ld-border" />
                )}
                {(['Date', 'LCP', 'CLS', 'TBT', 'FCP', 'Score', ''] as const).map((h, i) => (
                  <th
                    key={`${h}-${i}`}
                    className={[
                      'py-[12px] px-[10px] pb-[10px] font-mono text-[10px] tracking-[.1em] uppercase text-ld-text-3 font-semibold border-b border-ld-border',
                      h === '' ? 'text-right' : 'text-left',
                      h === 'TBT' || h === 'FCP' ? 'max-[680px]:hidden' : '',
                    ].join(' ')}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...group.entries].reverse().map((entry) => (
                <AuditRow
                  key={entry.id}
                  entry={entry}
                  compareMode={compareMode}
                  isSelected={selectedIds.has(entry.id)}
                  onToggleSelect={onToggleSelect}
                  onOpen={onOpen}
                  loadingId={loadingId}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
