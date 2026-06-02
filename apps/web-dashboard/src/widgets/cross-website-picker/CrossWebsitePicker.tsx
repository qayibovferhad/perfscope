import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Globe, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { useWebsites } from '@/features/dashboard/hooks/useWebsites';
import { useProjectAudits, type ProjectAuditEntry } from '@/features/projects/hooks/useProjectAudits';
import { scoreColor } from '@/entities/analysis';

interface Props {
  excludeProjectId: string;
  onSelect: (entry: ProjectAuditEntry) => void;
  onClose: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function AuditList({ projectId, onSelect }: {
  projectId: string; onSelect: (entry: ProjectAuditEntry) => void;
}) {
  const { data, isLoading, isError } = useProjectAudits(projectId);

  if (isLoading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--ps-accent)' }} />
    </div>
  );

  if (isError || !data || data.stats.totalAudits === 0) return (
    <div className="flex items-center gap-2 py-6 justify-center text-xs"
      style={{ color: 'var(--ps-text-muted)' }}>
      <AlertCircle className="w-3.5 h-3.5" />
      No audits found for this website
    </div>
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
            style={{ background: 'rgba(255,255,255,0.03)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
          >
            <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--ps-text-secondary)' }}>
              {entry.routePath}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--ps-text-muted)' }}>
              {formatDate(entry.timestamp)}
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
  const selectedWebsite = others.find((w) => w._id === selectedId);

  function handleSelect(entry: ProjectAuditEntry) {
    onSelect(entry);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--ps-card-bg)', border: '1px solid var(--ps-panel-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--ps-divider)' }}>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" style={{ color: 'var(--ps-accent)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--ps-text-heading)' }}>
              Compare with another website
            </span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--ps-text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Website selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--ps-text-muted)' }}>
              Select Website
            </label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--ps-accent)' }} />
              </div>
            ) : others.length === 0 ? (
              <p className="text-xs py-3 text-center" style={{ color: 'var(--ps-text-muted)' }}>
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
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                      style={{
                        background: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                        border: isSelected ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                      }}
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: isSelected ? 'var(--ps-accent)' : 'var(--ps-text-muted)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--ps-text-heading)' }}>
                          {w.name || w.url}
                        </p>
                        <p className="text-[10px] font-mono truncate" style={{ color: 'var(--ps-text-muted)' }}>
                          {w.url}
                        </p>
                      </div>
                      <ChevronDown
                        className="w-3 h-3 shrink-0 transition-transform"
                        style={{
                          color: 'var(--ps-text-muted)',
                          transform: isSelected ? 'rotate(180deg)' : 'none',
                        }}
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
              <label className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--ps-text-muted)' }}>
                Select Audit
              </label>
              <AuditList projectId={selectedId} onSelect={handleSelect} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
