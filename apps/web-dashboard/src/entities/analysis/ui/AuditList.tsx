import { useState, useRef, useId, useLayoutEffect, useEffect } from 'react';
import { TriangleAlert, Zap, ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Segmented } from '@/shared/ui/segmented';
import { Input } from '@/shared/ui/input';
import { AiNote } from '@/shared/ui/ai-card';
import { matchesAuditQuery, groupAudits, parseAuditDescription, AUDIT_CATEGORY_LABEL, AUDIT_CATEGORY_ORDER } from '../lib';
import { AuditDetails } from './AuditDetails';
import type { AuditItem, AnalysisCategory, PreviousRunSummary } from '@/entities/analysis';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'critical' | 'high' | 'other';
type CategoryKey = 'all' | AnalysisCategory;

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'all',      label: 'All'      },
  { value: 'critical', label: 'Critical' },
  { value: 'high',     label: 'High'     },
  { value: 'other',    label: 'Other'    },
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
  audit, isOpen, bodyId, onToggle, aiPending, isNew, rowRef,
}: {
  audit: AuditItem;
  isOpen: boolean;
  bodyId: string;
  onToggle: () => void;
  aiPending?: boolean;
  /** Not reported by the previous run of this page. */
  isNew?: boolean;
  rowRef?: (el: HTMLDivElement | null) => void;
}) {
  const bodyEl = useRef<HTMLDivElement>(null);
  const tier = sevTier(audit.impact);

  // The body animates to a measured pixel height, so it has to be re-measured whenever its
  // contents change — not only when it opens. Gemini's explanation lands seconds after the
  // report renders, and a row already open when it arrives would otherwise stay sized for
  // the description alone and clip the new line.
  const [bodyHeight, setBodyHeight] = useState(0);
  useLayoutEffect(() => {
    setBodyHeight(bodyEl.current?.scrollHeight ?? 0);
  }, [isOpen, audit.description, audit.aiExplanation, audit.details, aiPending]);

  return (
    <div ref={rowRef} className={cn(
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
            ? 'text-ld-rose   bg-ld-rose-soft border border-ld-rose-fill'
            : tier === 'warn'
            ? 'text-ld-amber  bg-ld-amber-soft  border border-ld-amber-fill'
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
            {isNew && (
              <span
                title="This issue was not reported in the previous run of this page"
                className="ml-[8px] align-middle font-mono text-[9.5px] font-semibold uppercase tracking-[.08em] px-[6px] py-[2px] rounded-[5px] border border-ld-amber-line bg-ld-amber-soft text-ld-amber"
              >
                new
              </span>
            )}
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
        ref={bodyEl}
        className="overflow-hidden transition-[max-height] duration-[350ms] ease-out"
        style={{ maxHeight: isOpen ? `${bodyHeight}px` : '0px' }}
      >
        <div className="px-[18px] pb-[18px] pl-[61px] max-[760px]:pl-[18px]">
          {audit.description && (
            <p className="text-[13.5px] text-ld-text-2 leading-[1.55] max-w-[70ch]">
              {parseAuditDescription(audit.description).map((part, i) => part.href
                ? (
                  <a
                    key={i}
                    href={part.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ld-accent underline underline-offset-2 hover:text-ld-accent-2"
                  >
                    {part.text}
                  </a>
                )
                : <span key={i}>{part.text}</span>)}
            </p>
          )}
          {/* Lighthouse's description above is the same sentence on every site; this is the
              half that is about *this* page. */}
          <AiNote
            text={audit.aiExplanation}
            pending={aiPending && !audit.aiExplanation}
            className="mt-[10px] max-w-[70ch]"
          />
          <AuditDetails details={audit.details} />
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AuditList({ audits, previous, aiPending, openAuditId }: {
  audits: AuditItem[];
  /** The run this one is compared against — drives the "new" pills and the fixed list. */
  previous?: PreviousRunSummary | undefined;
  aiPending?: boolean;
  /** Open and scroll to this audit on mount — the `?audit=` deep link. */
  openAuditId?: string | undefined;
}) {
  const uid                       = useId();
  const [openId, setOpenId]       = useState<string | null>(openAuditId ?? null);
  const [filter, setFilter]       = useState<FilterKey>('all');
  const [category, setCategory]   = useState<CategoryKey>('all');
  const [query, setQuery]         = useState('');
  const [showFixed, setShowFixed] = useState(false);
  const deepLinked = useRef<HTMLDivElement | null>(null);

  // A link to one finding has to land on it, not near it. Runs once: after that the
  // reader owns the scroll position.
  useEffect(() => {
    if (!openAuditId) return;
    deepLinked.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [openAuditId]);

  if (audits.length === 0) return null;

  const newIds = new Set(previous?.newAuditIds ?? []);
  const fixed  = previous?.fixedAudits ?? [];

  const sorted    = sortAudits(audits);
  const critCount = sorted.filter(a => a.impact === 'critical').length;

  // Audits stored before the category field existed have none; a filter that silently
  // hid every one of them would be worse than no filter.
  const categorised   = sorted.filter(a => a.category);
  const hasCategories = categorised.length > 0;
  const categoryCounts = AUDIT_CATEGORY_ORDER.map(key => ({
    key, count: sorted.filter(a => a.category === key).length,
  })).filter(c => c.count > 0);

  const visible = sorted
    .filter(a => category === 'all' || a.category === category)
    .filter(a => matchFilter(a.impact, filter))
    .filter(a => matchesAuditQuery(a, query));

  // Grouping earns its space only when the view is one wide category and the groups
  // actually split it — a single group under a header is a header for nothing.
  const groups = category === 'accessibility' ? groupAudits(visible) : [];
  const grouped = groups.length > 1 ? groups : null;

  const filtered = category !== 'all' || filter !== 'all' || query.trim() !== '';

  function toggle(id: string) {
    setOpenId(prev => (prev === id ? null : id));
  }

  /** Keep an open row from being hidden by a filter the reader just changed. */
  function closeIfHidden(next: { filter?: FilterKey; category?: CategoryKey; query?: string }) {
    if (openId === null) return;
    const open = sorted.find(a => a.id === openId);
    if (!open) return;
    const stillVisible =
      (next.category ?? category) === 'all' || open.category === (next.category ?? category);
    if (!stillVisible
      || !matchFilter(open.impact, next.filter ?? filter)
      || !matchesAuditQuery(open, next.query ?? query)) {
      setOpenId(null);
    }
  }

  function clearFilters() {
    setFilter('all');
    setCategory('all');
    setQuery('');
  }

  function renderRow(auditItem: AuditItem) {
    return (
      <IssueRow
        key={auditItem.id}
        audit={auditItem}
        isOpen={openId === auditItem.id}
        bodyId={`${uid}-body-${auditItem.id}`}
        onToggle={() => toggle(auditItem.id)}
        aiPending={aiPending}
        isNew={newIds.has(auditItem.id)}
        {...(auditItem.id === openAuditId ? { rowRef: (el: HTMLDivElement | null) => { deepLinked.current = el; } } : {})}
      />
    );
  }

  return (
    <div>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-[12px] mb-[14px] flex-wrap">
        {/* The same level as the report's other section titles — this is the last and
            longest section on the screen, and it was the one with no heading at all. */}
        <h2 className="font-mono text-[11px] tracking-[.14em] uppercase text-ld-text-3 m-0">
          Opportunities &amp; diagnostics
        </h2>

        {/* Critical count pill */}
        {critCount > 0 ? (
          <span className="inline-flex items-center gap-[7px] font-mono text-[11.5px] font-semibold px-[10px] py-[4px] rounded-full text-ld-rose bg-ld-rose-soft border border-ld-rose-line">
            <TriangleAlert className="w-[13px] h-[13px]" />
            {critCount} critical
          </span>
        ) : (
          <span className="inline-flex items-center gap-[7px] font-mono text-[11.5px] font-semibold px-[10px] py-[4px] rounded-full text-[var(--ld-accent)] bg-ld-accent-soft border border-ld-accent-line">
            No critical issues
          </span>
        )}

        {/* Severity filter */}
        <Segmented
          size="sm"
          ariaLabel="Severity filter"
          className="ml-auto max-[760px]:w-full"
          options={FILTERS}
          value={filter}
          onChange={(key) => { closeIfHidden({ filter: key }); setFilter(key); }}
        />
      </div>

      {/* ── Category + search ─────────────────────────────────────────────── */}
      {hasCategories && (
        <div className="flex items-center gap-[10px] mb-[14px] flex-wrap">
          <Segmented
            size="sm"
            ariaLabel="Category filter"
            className="max-[760px]:w-full"
            options={[
              { value: 'all' as CategoryKey, label: `All ${sorted.length}` },
              ...categoryCounts.map(c => ({
                value: c.key as CategoryKey,
                label: `${AUDIT_CATEGORY_LABEL[c.key]} ${c.count}`,
              })),
            ]}
            value={category}
            onChange={(key) => { closeIfHidden({ category: key }); setCategory(key); }}
          />
          <Input
            icon={<Search />}
            mono
            value={query}
            onChange={(e) => { closeIfHidden({ query: e.target.value }); setQuery(e.target.value); }}
            placeholder="Search audits, selectors, files"
            aria-label="Search audits"
            wrapperClassName="ml-auto max-w-[320px] max-[760px]:max-w-none max-[760px]:w-full"
            className="text-[13px] py-[7px]"
            {...(query
              ? { trailing: (
                  <button
                    type="button"
                    onClick={() => { closeIfHidden({ query: '' }); setQuery(''); }}
                    aria-label="Clear search"
                    className="grid place-items-center bg-transparent border-0 cursor-pointer text-ld-text-3 hover:text-ld-text p-0"
                  >
                    <X className="w-[14px] h-[14px]" />
                  </button>
                ) }
              : {})}
          />
        </div>
      )}

      {/* ── Issue list ────────────────────────────────────────────────────── */}
      {grouped ? (
        <div className="grid gap-[18px]">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ld-text-3 mb-[8px] m-0">
                {group} <span className="text-ld-text-3/70">· {items.length}</span>
              </p>
              <div className="grid gap-[8px]">{items.map(renderRow)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-[8px]">{visible.map(renderRow)}</div>
      )}

      {visible.length === 0 && (
        <div className="text-center py-[24px]">
          <p className="font-mono text-[12px] text-ld-text-3 m-0">
            {query.trim()
              ? <>No audits match “{query.trim()}”{category !== 'all' ? ` in ${AUDIT_CATEGORY_LABEL[category]}` : ''}.</>
              : 'No issues in this category.'}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-[8px] font-mono text-[12px] font-semibold text-ld-accent bg-transparent border-0 cursor-pointer p-0"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Progress is as much a result as the remaining problems are, and it is the half
          this list never showed. Collapsed, and worded as "no longer reported" rather than
          "fixed by you": an audit can also drop out because the page changed around it. */}
      {fixed.length > 0 && (
        <div className="mt-[12px]">
          <button
            type="button"
            onClick={() => setShowFixed(v => !v)}
            aria-expanded={showFixed}
            className="inline-flex items-center gap-[7px] font-mono text-[12px] font-semibold text-ld-score-good bg-transparent border-0 cursor-pointer p-0"
          >
            <Check className="w-[13px] h-[13px]" aria-hidden />
            {fixed.length} no longer reported since last run
            <ChevronDown className={cn('w-[13px] h-[13px] transition-transform', showFixed && 'rotate-180')} aria-hidden />
          </button>
          {showFixed && (
            <ul className="m-0 mt-[8px] p-0 list-none grid gap-[4px]">
              {fixed.map(f => (
                <li key={f.id} className="font-mono text-[12px] text-ld-text-3 truncate">
                  {f.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
