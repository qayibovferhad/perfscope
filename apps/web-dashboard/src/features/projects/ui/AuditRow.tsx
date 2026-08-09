import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import type { ProjectAuditEntry } from '@/entities/history';
import { Button } from '@/shared/ui/button';
import { ConfirmModal } from '@/shared/ui/modal';
import { useDeleteAudit } from '@/entities/history';
import { scoreBand, vitalBand, type ScoreBand } from '@/entities/analysis';
import { formatAuditDate, formatMs, formatTbt } from '../lib/formatters';

// ─── CWV band styling ─────────────────────────────────────────────────────────

const BAND: Record<ScoreBand, string> = {
  good: 'text-ld-accent-2',
  warn: 'text-ld-amber',
  poor: 'text-ld-rose',
};

// ─── Audit row ────────────────────────────────────────────────────────────────

export function AuditRow({
  entry, projectId, compareMode, isSelected, onToggleSelect, onOpen, loadingId,
}: {
  entry: ProjectAuditEntry;
  projectId: string;
  compareMode: boolean;
  isSelected: boolean;
  onToggleSelect: (entry: ProjectAuditEntry) => void;
  onOpen: (entry: ProjectAuditEntry) => void;
  loadingId: string | null;
}) {
  const navigate  = useNavigate();
  const perf      = entry.scores.performance;
  const isLoading = loadingId === entry.id;
  const m         = entry.metrics;
  const remove    = useDeleteAudit();

  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleRowClick() {
    if (compareMode) onToggleSelect(entry);
  }

  return (
    <tr
      className={`transition-[background] duration-[150ms] hover:bg-ld-surface-2 ${compareMode ? 'cursor-pointer' : ''}`}
      onClick={handleRowClick}
    >
      {/* Compare checkbox */}
      {compareMode && (
        <td className="py-[13px] px-[10px] border-b border-ld-border w-8">
          <div
            className="w-4 h-4 rounded flex items-center justify-center transition-all"
            style={{
              border:     isSelected ? '2px solid var(--ld-accent)' : '2px solid var(--ld-border-strong)',
              background: isSelected ? 'var(--ld-accent)' : 'transparent',
            }}
          >
            {isSelected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
          </div>
        </td>
      )}

      {/* Date */}
      <td className="py-[13px] px-[10px] border-b border-ld-border font-mono text-[13px] text-ld-text font-medium whitespace-nowrap">
        {formatAuditDate(entry.timestamp)}
      </td>

      {/* LCP */}
      <td className={`py-[13px] px-[10px] border-b border-ld-border font-mono text-[13px] ${BAND[vitalBand('lcp', m.lcp)]}`}>
        {formatMs(m.lcp)}
      </td>

      {/* CLS */}
      <td className={`py-[13px] px-[10px] border-b border-ld-border font-mono text-[13px] ${BAND[vitalBand('cls', m.cls)]}`}>
        {m.cls.toFixed(2)}
      </td>

      {/* TBT — hidden under 680px */}
      <td className={`py-[13px] px-[10px] border-b border-ld-border font-mono text-[13px] max-[680px]:hidden ${BAND[vitalBand('tbt', m.tbt)]}`}>
        {formatTbt(m.tbt)}
      </td>

      {/* FCP — hidden under 680px */}
      <td className={`py-[13px] px-[10px] border-b border-ld-border font-mono text-[13px] max-[680px]:hidden ${BAND[vitalBand('fcp', m.fcp)]}`}>
        {formatMs(m.fcp)}
      </td>

      {/* Score */}
      <td className="py-[13px] px-[10px] border-b border-ld-border">
        <span className={`font-mono text-[14px] font-bold ${BAND[scoreBand(perf)]}`}>{perf}</span>
      </td>

      {/* Actions */}
      <td className="py-[13px] px-[10px] border-b border-ld-border">
        {!compareMode && (
          <div className="flex items-center gap-[8px] justify-end">
            {/* Re-audit ghost */}
            <Button
              variant="outline"
              size="icon"
              title="Re-audit"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/app?url=${encodeURIComponent(entry.url)}&projectId=${projectId}`);
              }}
            >
              <RefreshCw />
            </Button>

            {/* Report primary */}
            <Button
              size="sm"
              disabled={isLoading}
              onClick={(e) => { e.stopPropagation(); onOpen(entry); }}
            >
              {isLoading
                ? <Loader2 className="w-[14px] h-[14px] animate-spin" />
                : <ExternalLink className="w-[14px] h-[14px]" />}
              Report
            </Button>

            {/* Delete audit */}
            <Button
              variant="outline"
              size="icon"
              title="Delete this audit"
              disabled={remove.isPending}
              className="hover:text-ld-rose hover:border-ld-rose"
              onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            >
              {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            </Button>

            <ConfirmModal
              open={confirmOpen}
              title="Delete this audit?"
              subtitle="This cannot be undone."
              confirmLabel="Delete audit"
              confirmIcon={<Trash2 />}
              isPending={remove.isPending}
              onClose={() => setConfirmOpen(false)}
              onConfirm={() => remove.mutate(entry.id, { onSettled: () => setConfirmOpen(false) })}
            >
              <div className="flex flex-col gap-[3px] p-4 rounded-[13px] border border-ld-border bg-ld-surface-2">
                <b className="font-mono text-[13px] text-ld-text truncate">{entry.url}</b>
                <span className="font-mono text-[12px] text-ld-text-3">
                  {formatAuditDate(entry.timestamp)} · performance {perf}
                </span>
              </div>
              <p className="text-[13px] text-ld-text-2 leading-[1.55]">
                The audit disappears from this table, from the site's history and from the
                score averages. The website itself is untouched.
              </p>
            </ConfirmModal>
          </div>
        )}
      </td>
    </tr>
  );
}
