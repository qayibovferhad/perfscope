import { useState } from 'react';
import { Globe, ChevronDown, Loader2 } from 'lucide-react';
import { useWebsites } from '@/entities/website';
import { scoreColor } from '@/entities/analysis';
import { useProjectAudits, type ProjectAuditEntry } from '@/features/projects/model/useProjectAudits';
import { Modal } from '@/shared/ui/modal';
import { StatePanel } from '@/shared/ui/state-panel';
import { fmtDateTime } from '@/shared/lib/time';

interface Props {
  excludeProjectId: string;
  onSelect: (entry: ProjectAuditEntry) => void;
  onClose: () => void;
}


function AuditList({ projectId, onSelect }: {
  projectId: string; onSelect: (entry: ProjectAuditEntry) => void;
}) {
  const { data, isLoading, isError } = useProjectAudits(projectId);

  if (isLoading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-4 h-4 animate-spin text-ld-accent" />
    </div>
  );

  if (isError) return (
    <StatePanel compact variant="error" title="Could not load this website's audits" />
  );

  if (!data || data.stats.totalAudits === 0) return (
    <StatePanel compact title="No audits found for this website" />
  );

  const allEntries = data.groups
    .flatMap((g) => g.entries.map((e) => ({ ...e, routePath: g.routePath })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
      {allEntries.map((entry) => {
        const perf = entry.scores.performance;
        const color = scoreColor(perf);
        return (
          <button
            key={entry.id}
            onClick={() => onSelect(entry)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors bg-ld-surface-2 hover:bg-ld-accent-soft"
          >
            <span className="text-xs font-mono flex-1 truncate text-ld-text-2">
              {entry.routePath}
            </span>
            <span className="text-[11px] text-ld-text-3">
              {fmtDateTime(entry.timestamp)}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}>
              {perf}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CrossWebsitePicker({ excludeProjectId, onSelect, onClose }: Props) {
  const { websites, isLoading } = useWebsites();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const others = websites.filter((w) => w._id !== excludeProjectId);

  function handleSelect(entry: ProjectAuditEntry) {
    onSelect(entry);
  }

  return (
    <Modal open onClose={onClose}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Globe className="w-4 h-4 text-ld-accent" />
        <span className="text-sm font-bold text-ld-text">
          Compare with another website
        </span>
      </div>

      <div className="space-y-4">
          {/* Website selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ld-text-3">
              Select Website
            </label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-ld-accent" />
              </div>
            ) : others.length === 0 ? (
              <p className="text-xs py-3 text-center text-ld-text-3">
                No other websites found. Add more websites to compare.
              </p>
            ) : (
              <div className="space-y-1">
                {others.map((w) => {
                  const isSelected = selectedId === w._id;
                  return (
                    <button
                      key={w._id}
                      onClick={() => setSelectedId(isSelected ? null : w._id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border ${
                        isSelected
                          ? 'bg-ld-accent-soft border-ld-accent-line'
                          : 'bg-ld-surface-2 border-transparent hover:bg-ld-surface-hover'
                      }`}
                    >
                      <Globe className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-ld-accent' : 'text-ld-text-3'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate text-ld-text">
                          {w.name || w.url}
                        </p>
                        <p className="text-[10px] font-mono truncate text-ld-text-3">
                          {w.url}
                        </p>
                      </div>
                      <ChevronDown
                        className={`w-3 h-3 shrink-0 transition-transform text-ld-text-3 ${isSelected ? 'rotate-180' : ''}`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Audit list for selected website */}
          {selectedId && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ld-text-3">
                Select Audit
              </label>
              <AuditList projectId={selectedId} onSelect={handleSelect} />
            </div>
          )}
      </div>
    </Modal>
  );
}
