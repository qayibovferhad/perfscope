import { Layers, ListChecks, Waves, Sparkles } from 'lucide-react';
import { InstrumentField } from '@/shared/ui/instrument';

/** What every report carries, whatever the page turns out to contain. Panels that depend
 *  on the page having something (bundles, interactions, layout shifts, field data) are
 *  deliberately not listed: promising a panel that then never appears is worse than
 *  saying nothing about it. */
const COMING = [
  { icon: Layers,     label: 'Resource breakdown', hint: 'weight by type, oversized files' },
  { icon: ListChecks, label: 'Opportunities & diagnostics', hint: 'what to fix, worst first' },
  { icon: Waves,      label: 'Timeline & filmstrip', hint: 'what painted, and when' },
  { icon: Sparkles,   label: 'AI insights', hint: 'written once the run lands' },
];

/**
 * The rest of the report, while the run is still measuring.
 *
 * A run left the page ending at the waterfall skeleton — a screen and a half of content
 * where the finished report is ten — so the window below it was simply empty, and the
 * layout jumped by a page and a half when the results landed. The reader also had no way
 * to know anything else was coming.
 *
 * Not skeletons: a stack of grey boxes pretending to be panels claims a shape the report
 * may not take. These are the *names* of what is being measured, dimmed, on the same
 * field the rest of the instrument language uses.
 */
export function PendingSections() {
  return (
    <InstrumentField className="mt-[26px]" marks={false}>
      <div className="px-[20px] py-[18px]">
        <p className="font-mono text-[10.5px] uppercase tracking-[.18em] text-ld-text-3 mb-[14px]">
          Still measuring
        </p>

        <ul className="grid grid-cols-2 gap-x-[22px] gap-y-[12px] max-[640px]:grid-cols-1">
          {COMING.map(item => (
            <li key={item.label} className="flex items-center gap-[11px] min-w-0">
              <span className="w-[28px] h-[28px] rounded-[9px] grid place-items-center border border-ld-border bg-ld-surface-2 text-ld-text-3 shrink-0 [&_svg]:w-[14px] [&_svg]:h-[14px]">
                <item.icon />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ld-text-2 truncate">{item.label}</span>
                <span className="block text-[11.5px] text-ld-text-3 truncate">{item.hint}</span>
              </span>
              {/* The one live element: the same pulse the analyzer uses for a running
                  audit elsewhere, so "pending" reads the same way across the app. */}
              <span aria-hidden className="ml-auto w-[6px] h-[6px] rounded-full bg-ld-accent-line ld-pulse shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    </InstrumentField>
  );
}
