import { memo } from 'react';
import { cn } from '@/shared/lib/utils';
import { fmtBytesOrDash as fmtBytes } from '@/shared/lib/format';
import { useTimelineContext } from '../model/TimelineContext';
import { resourceFilename } from '../lib/waterfall';
import { RequestDetailPanel } from './RequestDetailPanel';
import { RESOURCE_TYPES, resourceBadgeStyle } from '@/entities/analysis';
import type { NetworkRequest, ResourceType } from '@/entities/analysis';

/**
 * The waiting (TTFB) segment of the 'agnostic' bar style stays type-muted on purpose:
 * the timeline waterfall is read against the filmstrip, where a second tinted hue per
 * row competes with the metric markers. Colour that carries meaning — the badge, the
 * download bar — comes from RESOURCE_TYPES.
 */
const BAR_WAIT_CLS: Record<ResourceType, string> = {
  script:     'bg-ld-border-strong',
  stylesheet: 'bg-ld-border-strong',
  image:      'bg-ld-accent-soft',
  font:       'bg-ld-border-strong',
  document:   'bg-ld-accent-line',
  media:      'bg-ld-border-strong',
  other:      'bg-ld-border',
};

export interface WaterfallRowProps {
  req:        NetworkRequest;
  index:      number;
  axisMs:     number;
  /** Label-column width — the two waterfalls deliberately differ (280 vs 320). */
  leftW:      number;
  /** 'typed' colours the bar by resource type; 'agnostic' mutes the wait segment (see BAR_WAIT_CLS). */
  barStyle:   'typed' | 'agnostic';
  /** Tighter row for the variant that renders beside the filmstrip. */
  dense?:     boolean;
  /** Mirror hover into TimelineContext.hoveredUrl (flame-chart highlight). */
  trackHover?: boolean;
  isSelected: boolean;
  onSelect:   () => void;
  onDeselect: () => void;
  rowRef:  (el: HTMLDivElement | null) => void;
  ttfbRef: (el: HTMLDivElement | null) => void;
  dlRef:   (el: HTMLDivElement | null) => void;
  shimRef: (el: HTMLDivElement | null) => void;
}

/**
 * One request row — name cell, timing lane, optional detail panel. Shared by both
 * waterfall variants (they are alternates, never on screen together; see lib/waterfall.ts),
 * which each held a full copy of this markup differing only in bar colouring and density.
 * The pending/loading/loaded animation is driven imperatively through the ref callbacks —
 * see useWaterfallPlayhead.
 */
export const WaterfallRow = memo(function WaterfallRow({
  req, index, axisMs, leftW, barStyle, dense, trackHover,
  isSelected, onSelect, onDeselect,
  rowRef, ttfbRef, dlRef, shimRef,
}: WaterfallRowProps) {
  const ctx  = useTimelineContext();
  const cfg  = RESOURCE_TYPES[req.resourceType];
  const Icon = cfg.icon;
  const name = resourceFilename(req.url);

  const duration = req.endTime - req.startTime;
  const barLeft  = axisMs > 0 ? (req.startTime / axisMs) * 100 : 0;
  const barWidth = axisMs > 0 ? Math.max((duration / axisMs) * 100, 0.3) : 0;
  const ttfbPct  = duration > 0 ? Math.min((req.ttfb / duration) * 100, 100) : 0;

  return (
    <div className="relative">
      <div
        ref={rowRef}
        data-state="loaded"
        onClick={onSelect}
        onMouseEnter={trackHover ? () => ctx?.hoveredUrl.set(req.url) : undefined}
        onMouseLeave={trackHover ? () => ctx?.hoveredUrl.set('') : undefined}
        className={cn(
          'flex items-center border-b border-ld-border cursor-pointer select-none',
          'transition-[opacity,filter] duration-200 ease-in-out [will-change:opacity,filter]',
          'data-[state=pending]:opacity-20 data-[state=pending]:grayscale',
          index % 2 === 0 ? 'bg-ld-surface' : 'bg-ld-bg',
          isSelected && 'ring-1 ring-inset ring-ld-accent-line bg-ld-accent-soft',
        )}
      >
        {/* Name column */}
        <div
          className={cn('flex items-center gap-2 px-3 shrink-0 border-r border-ld-border', dense ? 'py-1' : 'py-1.5')}
          style={{ width: leftW }}
        >
          <Icon className="w-3 h-3 shrink-0 text-ld-text-3" />
          <span className="font-mono text-[11px] text-ld-text-2 truncate flex-1 leading-none" title={req.url}>
            {name}
          </span>
          <span
            className="text-[9.5px] font-semibold font-mono px-[6px] py-[2px] rounded-[5px] border shrink-0"
            style={resourceBadgeStyle(req.resourceType)}
          >
            {cfg.label}
          </span>
          <span className="text-[10px] text-ld-text-3 tabular-nums shrink-0 w-11 text-right font-mono">
            {fmtBytes(req.transferSize)}
          </span>
        </div>

        {/* Lane */}
        <div className={cn('flex-1 relative flex items-center', dense ? 'h-5' : 'h-7')}>
          <div className="absolute inset-x-0 h-px bg-ld-border" />
          {barWidth > 0 && (
            <div
              className={cn('absolute rounded-sm flex overflow-hidden', dense ? 'h-2.5' : 'h-3.5')}
              style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
            >
              {barStyle === 'agnostic' ? (
                <>
                  <div
                    ref={ttfbRef}
                    className={cn('h-full transition-opacity duration-150', BAR_WAIT_CLS[req.resourceType])}
                    style={{ width: `${ttfbPct}%` }}
                  />
                  <div ref={dlRef} className="h-full flex-1 transition-opacity duration-150 bg-ld-accent" />
                </>
              ) : (
                <>
                  <div
                    ref={ttfbRef}
                    className="h-full transition-opacity duration-150"
                    style={{ width: `${ttfbPct}%`, backgroundColor: cfg.wait }}
                  />
                  <div
                    ref={dlRef}
                    className="h-full flex-1 transition-opacity duration-150"
                    style={{ backgroundColor: cfg.bar }}
                  />
                </>
              )}
              <div ref={shimRef} className="wf-shim absolute inset-0 rounded-sm pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {isSelected && <RequestDetailPanel req={req} onClose={onDeselect} />}
    </div>
  );
});
