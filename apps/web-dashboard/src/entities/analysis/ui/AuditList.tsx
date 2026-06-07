import { useState, useRef, useId } from 'react';
import { TriangleAlert, Zap, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { AuditItem } from '@/entities/analysis';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'critical' | 'high' | 'other';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'critical', label: 'Critical' },
  { key: 'high',     label: 'High'     },
  { key: 'other',    label: 'Other'    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortAudits(audits: AuditItem[]): AuditItem[] {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...audits].sort((a, b) => (order[a.impact] ?? 3) - (order[b.impact] ?? 3));
}

function matchFilter(impact: AuditItem['impact'], key: FilterKey): boolean {
  if (key === 'all')      return true;
  if (key === 'critical') return impact === 'critical';
  if (key === 'high')     return impact === 'high';
  return impact === 'medium' || impact === 'low';
}

function sevTier(impact: AuditItem['impact']): 'high' | 'warn' | 'low' {
  if (impact === 'critical') return 'high';
  if (impact === 'high' || impact === 'medium') return 'warn';
  return 'low';
}

// ─── Issue row ────────────────────────────────────────────────────────────────

function IssueRow({
  audit, isOpen, bodyId, onToggle,
}: {
  audit: AuditItem;
  isOpen: boolean;
  bodyId: string;
  onToggle: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const tier = sevTier(audit.impact);

  return (
    <div className={cn(
      'rounded-[12px] border bg-ld-surface overflow-hidden transition-[border-color] duration-200',
      isOpen ? 'border-ld-accent-line' : 'border-ld-border',
    )}>
      {/* Trigger button */}
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        className="w-full flex items-center gap-[13px] px-[18px] py-[16px] text-left cursor-pointer bg-transparent border-0"
      >
        {/* Severity icon tile */}
        <span className={cn(
          'w-[30px] h-[30px] rounded-[8px] grid place-items-center shrink-0',
          tier === 'high'
            ? 'text-ld-rose   bg-[rgba(242,100,122,.1)] border border-[rgba(242,100,122,.25)]'
            : tier === 'warn'
            ? 'text-ld-amber  bg-[rgba(230,162,60,.1)]  border border-[rgba(230,162,60,.25)]'
            : 'text-ld-text-3 bg-ld-surface-2            border border-ld-border',
        )}>
          {tier === 'high'
            ? <Zap          className="w-[16px] h-[16px]" />
            : <TriangleAlert className="w-[16px] h-[16px]" />
          }
        </span>

        {/* Title + mono meta */}
        <span className="flex-1 min-w-0">
          <b className="block text-[14.5px] font-semibold text-ld-text leading-snug">
            {audit.title}
          </b>
          {audit.displayValue && (
            <span className={cn(
              'block font-mono text-[12px] mt-[2px]',
              tier === 'high' ? 'text-ld-rose' : 'text-ld-text-3',
            )}>
              {audit.displayValue}
            </span>
          )}
        </span>

        {/* Rotating chevron */}
        <span className={cn(
          'w-[22px] h-[22px] grid place-items-center text-ld-text-3 transition-transform duration-300 shrink-0',
          isOpen && 'rotate-180',
        )}>
          <ChevronDown className="w-[16px] h-[16px]" />
        </span>
      </button>

      {/* Animated body */}
      <div
        id={bodyId}
        ref={bodyRef}
        className="overflow-hidden transition-[max-height] duration-[350ms] ease-out"
        style={{ maxHeight: isOpen ? `${bodyRef.current?.scrollHeight ?? 9999}px` : '0px' }}
      >
        {audit.description && (
          <div className="px-[18px] pb-[18px] pl-[61px] max-[760px]:pl-[18px]">
            <p className="text-[13.5px] text-ld-text-2 leading-[1.55] max-w-[70ch]">
              {audit.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AuditList({ audits }: { audits: AuditItem[] }) {
  const uid                     = useId();
  const [openId, setOpenId]     = useState<string | null>(null);
  const [filter, setFilter]     = useState<FilterKey>('all');

  if (audits.length === 0) return null;

  const sorted    = sortAudits(audits);
  const critCount = sorted.filter(a => a.impact === 'critical').length;
  const visible   = sorted.filter(a => matchFilter(a.impact, filter));

  function toggle(id: string) {
    setOpenId(prev => (prev === id ? null : id));
  }

  function applyFilter(key: FilterKey) {
    setFilter(key);
    // Collapse open item if it becomes hidden
    if (openId !== null) {
      const open = sorted.find(a => a.id === openId);
      if (open && !matchFilter(open.impact, key)) setOpenId(null);
    }
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-[12px] mb-[14px] flex-wrap">
        <p className="font-mono text-[11px] tracking-[.14em] uppercase text-ld-text-3 m-0">
          Opportunities &amp; diagnostics
        </p>

        {/* Critical count pill */}
        {critCount > 0 ? (
          <span className="inline-flex items-center gap-[7px] font-mono text-[11.5px] font-semibold px-[10px] py-[4px] rounded-full text-ld-rose border border-[rgba(242,100,122,.3)] bg-[rgba(242,100,122,.08)]">
            <TriangleAlert className="w-[13px] h-[13px]" />
            {critCount} critical
          </span>
        ) : (
          <span className="inline-flex items-center gap-[7px] font-mono text-[11.5px] font-semibold px-[10px] py-[4px] rounded-full text-[var(--ld-accent-2)] border border-ld-accent-line bg-ld-accent-soft">
            No critical issues
          </span>
        )}

        {/* Segmented filter */}
        <div className="ml-auto flex gap-[4px] p-[3px] rounded-[10px] border border-ld-border bg-ld-bg-2 max-[760px]:w-full">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => applyFilter(key)}
              className={cn(
                'text-[12.5px] font-medium text-ld-text-2 px-[12px] py-[6px] rounded-[7px] transition-all duration-200 cursor-pointer border-0 bg-transparent',
                filter === key && 'bg-ld-surface text-ld-text font-semibold [box-shadow:0_1px_0_rgba(0,0,0,.2)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Issue list ──────────────────────────────────────────────────── */}
      <div className="grid gap-[8px]">
        {visible.map(audit => (
          <IssueRow
            key={audit.id}
            audit={audit}
            isOpen={openId === audit.id}
            bodyId={`${uid}-body-${audit.id}`}
            onToggle={() => toggle(audit.id)}
          />
        ))}
        {visible.length === 0 && (
          <p className="font-mono text-[12px] text-ld-text-3 text-center py-[24px]">
            No issues in this category.
          </p>
        )}
      </div>
    </div>
  );
}
