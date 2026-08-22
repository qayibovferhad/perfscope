import { useState } from 'react';
import { ChevronDown, FilePlus2, FileMinus2, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { fmtBytes } from '@/shared/lib/format';
import { fmtDateTime } from '@/shared/lib/time';
import { resourceFilename } from '../lib/waterfall';
import type { PreviousRunSummary, ResourceResize } from '@/entities/analysis';

/**
 * What the page shipped, or stopped shipping, since the run before this one.
 *
 * The same diff the AI is given as evidence and the regression alert names a cause from —
 * `AnalysisResult.previous.resourceDiff`, computed server-side once. Showing it here is
 * what lets a person check the sentence the AI wrote instead of taking it on faith.
 *
 * Collapsed to counts by default: on most runs this is a one-line "nothing much moved",
 * and a page that opens with twenty filenames buries the scores underneath it.
 */
export function SinceLastRun({ previous }: { previous: PreviousRunSummary | undefined }) {
  const [open, setOpen] = useState(false);

  const diff = previous?.resourceDiff;
  if (!previous || !diff) return null;

  const counts = [
    { key: 'added',   n: diff.added.length,   label: 'new',     Icon: FilePlus2,    tone: 'text-ld-amber' },
    { key: 'removed', n: diff.removed.length, label: 'removed', Icon: FileMinus2,   tone: 'text-ld-score-good' },
    { key: 'grown',   n: diff.grown.length,   label: 'grew',    Icon: TrendingUp,   tone: 'text-ld-rose' },
    { key: 'shrunk',  n: diff.shrunk.length,  label: 'shrank',  Icon: TrendingDown, tone: 'text-ld-score-good' },
  ].filter(c => c.n > 0);

  const vendors = [
    ...diff.librariesAdded.map(n => ({ name: n, added: true })),
    ...diff.vendorsAdded.map(n => ({ name: n, added: true })),
    ...diff.librariesRemoved.map(n => ({ name: n, added: false })),
    ...diff.vendorsRemoved.map(n => ({ name: n, added: false })),
  ];

  if (counts.length === 0 && vendors.length === 0) return null;

  return (
    <div className="rounded-[14px] border border-ld-border bg-ld-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-[10px] px-[16px] py-[12px] text-left hover:bg-ld-surface-2 transition-colors"
      >
        <span className="font-mono text-[11px] tracking-[.14em] uppercase text-ld-text-3">
          Since last run
        </span>
        <span className="flex items-center gap-[12px] flex-wrap">
          {counts.map(({ key, n, label, Icon, tone }) => (
            <span key={key} className={cn('inline-flex items-center gap-[5px] font-mono text-[12px] font-semibold', tone)}>
              <Icon className="w-[13px] h-[13px]" aria-hidden />
              {n} {label}
            </span>
          ))}
          {vendors.length > 0 && (
            <span className="inline-flex items-center gap-[5px] font-mono text-[12px] font-semibold text-ld-text-2">
              <Package className="w-[13px] h-[13px]" aria-hidden />
              {vendors.length} vendor{vendors.length === 1 ? '' : 's'} changed
            </span>
          )}
        </span>
        <ChevronDown
          className={cn('w-[15px] h-[15px] text-ld-text-3 ml-auto shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="px-[16px] pb-[14px] pt-[2px] grid gap-[10px]">
          <p className="font-mono text-[11px] text-ld-text-3 m-0">
            Compared with the run from {fmtDateTime(previous.at)}
          </p>
          <ChangeList title="New requests"     items={diff.added}   render={r => `${resourceFilename(r.url)} · ${fmtBytes(r.transferSize)}`} />
          <ChangeList title="No longer loaded" items={diff.removed} render={r => `${resourceFilename(r.url)} · ${fmtBytes(r.transferSize)}`} />
          <ChangeList title="Grew"   items={diff.grown}  render={resizeLine} />
          <ChangeList title="Shrank" items={diff.shrunk} render={resizeLine} />
          {vendors.length > 0 && (
            <ChangeList
              title="Libraries and vendors"
              items={vendors}
              render={v => `${v.added ? '+' : '−'} ${v.name}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

function resizeLine(r: ResourceResize): string {
  return `${resourceFilename(r.url)} · ${fmtBytes(r.fromBytes)} → ${fmtBytes(r.toBytes)}`;
}

function ChangeList<T>({ title, items, render }: {
  title: string;
  items: T[];
  render: (item: T) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ld-text-3 mb-[5px] m-0">{title}</p>
      <ul className="m-0 p-0 list-none grid gap-[3px]">
        {items.map((item, i) => (
          <li key={i} className="font-mono text-[12px] text-ld-text-2 truncate">
            {render(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}
