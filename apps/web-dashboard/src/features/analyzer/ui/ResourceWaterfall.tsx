import {
  useRef, useEffect, useMemo, memo, useState, useLayoutEffect, useCallback,
} from 'react';
import { Network } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { fmtMsOrDash as fmtMs, fmtBytesOrDash as fmtBytes } from '@/shared/lib/format';
import { PanelHeader, Chip } from '@/shared/ui/panel';
import { useTimelineContext } from '../model/TimelineContext';
import { MAX_ROWS, TICK_COUNT, resourceFilename } from '../lib/waterfall';
import { RequestDetailPanel } from './RequestDetailPanel';
import { RESOURCE_TYPES, resourceBadgeStyle, METRIC_MARKERS } from '@/entities/analysis';
import type { ParsedResources, NetworkRequest, ResourceType, CoreWebVitals } from '@/entities/analysis';

/** Label-column width. Wider than TimelineWaterfall's 280 on purpose (the type badge and
 *  size ride in this column) — but every width below must come from this constant: the
 *  header, gridline and playhead offsets used to hardcode `320px` classes beside it, so
 *  changing it silently sheared the layout. */
const LEFT_W = 320;

const FILTER_CHIPS: { key: ResourceType | 'all'; label: string }[] = [
  { key: 'all',        label: 'All'   },
  { key: 'script',     label: 'JS'    },
  { key: 'stylesheet', label: 'CSS'   },
  { key: 'image',      label: 'IMG'   },
  { key: 'font',       label: 'FONT'  },
  { key: 'document',   label: 'DOC'   },
  { key: 'media',      label: 'MEDIA' },
  { key: 'other',      label: 'XHR'   },
];



// ─── Detail panel ─────────────────────────────────────────────────────────────


// ─── Waterfall row ─────────────────────────────────────────────────────────────

interface RowProps {
  req:        NetworkRequest;
  index:      number;
  axisMs:     number;
  isSelected: boolean;
  onSelect:   () => void;
  onDeselect: () => void;
  rowRef:     (el: HTMLDivElement | null) => void;
  ttfbRef:    (el: HTMLDivElement | null) => void;
  dlRef:      (el: HTMLDivElement | null) => void;
  shimRef:    (el: HTMLDivElement | null) => void;
}

const WaterfallRow = memo(function WaterfallRow({
  req, index, axisMs, isSelected, onSelect, onDeselect,
  rowRef, ttfbRef, dlRef, shimRef,
}: RowProps) {
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
        className={cn(
          'flex items-center border-b border-ld-border cursor-pointer select-none',
          'transition-[opacity,filter] duration-200 ease-in-out [will-change:opacity,filter]',
          'data-[state=pending]:opacity-20 data-[state=pending]:grayscale',
          index % 2 === 0 ? 'bg-ld-surface' : 'bg-ld-bg',
          isSelected && 'ring-1 ring-inset ring-ld-accent-line bg-ld-accent-soft',
        )}
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-r border-ld-border"
          style={{ width: LEFT_W }}
        >
          <Icon className="w-3 h-3 shrink-0 text-ld-text-3" />
          <span className="font-mono text-[11px] text-ld-text-2 truncate flex-1 leading-none" title={req.url}>
            {name}
          </span>
          <span
            className="text-[9px] font-bold px-1 py-0.5 rounded border font-mono shrink-0"
            style={resourceBadgeStyle(req.resourceType)}
          >
            {cfg.label}
          </span>
          <span className="text-[10px] text-ld-text-3 tabular-nums shrink-0 w-11 text-right font-mono">
            {fmtBytes(req.transferSize)}
          </span>
        </div>

        <div className="flex-1 relative h-7 flex items-center">
          <div className="absolute inset-x-0 h-px bg-ld-border" />
          {barWidth > 0 && (
            <div
              className="absolute h-3.5 rounded-sm flex overflow-hidden"
              style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
            >
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
              <div ref={shimRef} className="wf-shim absolute inset-0 rounded-sm pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {isSelected && <RequestDetailPanel req={req} onClose={onDeselect} />}
    </div>
  );
});

// ─── Time axis ruler ───────────────────────────────────────────────────────────

function TimeAxis({ axisMs, metrics }: { axisMs: number; metrics?: CoreWebVitals }) {
  return (
    <div className="relative h-7">
      {Array.from({ length: TICK_COUNT + 1 }, (_, i) => (
        <div
          key={i}
          className={`absolute flex flex-col ${
            i === 0
              ? 'items-start translate-x-0'
              : i === TICK_COUNT
              ? 'items-end -translate-x-full'
              : 'items-center -translate-x-1/2'
          }`}
          style={{ left: `${(i / TICK_COUNT) * 100}%` }}
        >
          <div className="h-2 w-px bg-ld-border-strong" />
          <span className="text-[9px] font-mono text-ld-text-3 tabular-nums mt-0.5">
            {fmtMs((i / TICK_COUNT) * axisMs)}
          </span>
        </div>
      ))}

      {metrics && METRIC_MARKERS.map(({ key, label, color }) => {
        const ms  = metrics[key];
        if (!ms || ms <= 0 || ms > axisMs) return null;
        const pct = (ms / axisMs) * 100;
        return (
          <div
            key={key}
            className="absolute bottom-0 flex flex-col items-center -translate-x-1/2 pointer-events-none"
            style={{ left: `${pct}%` }}
          >
            <span className="text-[8.5px] font-mono font-bold tabular-nums px-1 py-px rounded bg-ld-surface" style={{ color }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ResourceWaterfall({
  resources,
  timelineDuration,
  metrics,
  showHeader = true,
}: {
  resources:         ParsedResources;
  timelineDuration?: number;
  metrics?:          CoreWebVitals;
  showHeader?:       boolean;
}) {
  const ctx = useTimelineContext();

  const [typeFilter, setTypeFilter] = useState<ResourceType | 'all'>('all');

  const allRows = useMemo<NetworkRequest[]>(() => {
    return resources.requests
      .filter(r => r.endTime > 0 && r.endTime < 600_000)
      .slice()
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, MAX_ROWS);
  }, [resources.requests]);

  const rows = useMemo<NetworkRequest[]>(() => {
    if (typeFilter === 'all') return allRows;
    return allRows.filter(r => r.resourceType === typeFilter);
  }, [allRows, typeFilter]);

  const wfMs   = useMemo(() => allRows.reduce((mx, r) => Math.max(mx, r.endTime), 0), [allRows]);
  const axisMs = (timelineDuration && timelineDuration > 0) ? timelineDuration : wfMs;

  const axisMsRef = useRef(axisMs);
  axisMsRef.current = axisMs;

  const hasTimingData = allRows.length > 0 && wfMs > 0;

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const handleSelect   = useCallback((i: number) => setSelectedIdx(p => p === i ? null : i), []);
  const handleDeselect = useCallback(() => setSelectedIdx(null), []);

  const rootRef      = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const labelRef     = useRef<HTMLSpanElement>(null);
  const chartWRef    = useRef(0);
  const rowRefs      = useRef<(HTMLDivElement | null)[]>([]);
  const ttfbRefs     = useRef<(HTMLDivElement | null)[]>([]);
  const dlRefs       = useRef<(HTMLDivElement | null)[]>([]);
  const shimRefs     = useRef<(HTMLDivElement | null)[]>([]);

  rowRefs.current.length  = rows.length;
  ttfbRefs.current.length = rows.length;
  dlRefs.current.length   = rows.length;
  shimRefs.current.length = rows.length;

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const update = () => { chartWRef.current = (rootRef.current?.clientWidth ?? 0) - LEFT_W; };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!ctx || !hasTimingData) return;

    const unsubscribe = ctx.motionMs.on('change', (sliderMs) => {
      const axMs   = axisMsRef.current;
      const netOff = ctx.networkOffset.current;

      if (indicatorRef.current) {
        const pct = Math.min(Math.max(sliderMs / axMs, 0), 1);
        indicatorRef.current.style.transform = `translateX(${(LEFT_W + chartWRef.current * pct).toFixed(1)}px)`;
      }

      if (labelRef.current) {
        labelRef.current.textContent = fmtMs(sliderMs);
      }

      for (let i = 0; i < rows.length; i++) {
        const rowEl = rowRefs.current[i];
        if (!rowEl) continue;

        const { startTime, endTime, ttfb } = rows[i];
        const frameStart = startTime + netOff;
        const frameEnd   = endTime   + netOff;

        const state: 'pending' | 'loading' | 'loaded' =
          sliderMs < frameStart ? 'pending' :
          sliderMs >= frameEnd  ? 'loaded'  :
                                  'loading';

        if (rowEl.dataset.state !== state) {
          rowEl.dataset.state = state;
          shimRefs.current[i]?.classList.toggle('wf-shim-active', state === 'loading');
        }

        const ttfbEl = ttfbRefs.current[i];
        const dlEl   = dlRefs.current[i];
        if (state === 'loading') {
          if (ttfbEl) ttfbEl.style.opacity = '1';
          if (dlEl)   dlEl.style.opacity   = sliderMs >= frameStart + ttfb ? '1' : '0.3';
        } else {
          if (ttfbEl) ttfbEl.style.opacity = '1';
          if (dlEl)   dlEl.style.opacity   = '1';
        }
      }
    });

    return unsubscribe;
  }, [ctx, rows, wfMs, hasTimingData]);

  if (!hasTimingData) {
    return (
      <div className="rounded-[16px] border border-ld-border bg-ld-surface overflow-hidden">
        <PanelHeader icon={<Network />} title="Network Waterfall" />
        <div className="px-4 py-8 text-center">
          <p className="text-[12.5px] text-ld-text-3">No network timing data available for this analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="rounded-[16px] border border-ld-border bg-ld-surface overflow-hidden">
      <style>{`
        @keyframes wf-shimmer {
          0%   { transform: translateX(-100%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateX(250%); opacity: 0; }
        }
        .wf-shim-active { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; }
        .wf-shim-active::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(20,192,138,0.22) 50%, transparent 100%);
          animation: wf-shimmer 1.3s ease-in-out infinite;
        }
      `}</style>

      {showHeader && (
        <PanelHeader
          icon={<Network />}
          title="Network Waterfall"
          meta={`${rows.length} / ${allRows.length} requests · ${fmtMs(wfMs)}`}
        >
          <div className="flex items-center gap-[5px] ml-2">
            {FILTER_CHIPS.map(({ key, label }) => (
              <Chip key={key} active={typeFilter === key} onClick={() => setTypeFilter(key)}>
                {label}
              </Chip>
            ))}
          </div>
        </PanelHeader>
      )}

      <div className="flex border-b border-ld-border bg-ld-bg text-[10px] font-semibold uppercase tracking-widest text-ld-text-3">
        <div className="shrink-0 flex items-center gap-6 px-3 py-2 border-r border-ld-border" style={{ width: LEFT_W }}>
          <span>Resource</span>
          <span className="ml-auto">Type</span>
          <span className="w-11 text-right">Size</span>
        </div>
        <div className="flex-1 overflow-hidden px-0 py-1">
          <TimeAxis axisMs={axisMs} metrics={metrics} />
        </div>
      </div>

      <div className="relative">
        <div className="max-h-[420px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--ld-border-strong)_transparent]">
          <div className="absolute top-0 bottom-0 right-0 pointer-events-none" style={{ left: LEFT_W }}>
            {Array.from({ length: TICK_COUNT - 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-ld-border"
                style={{ left: `${((i + 1) / TICK_COUNT) * 100}%` }}
              />
            ))}

            {metrics && METRIC_MARKERS.map(({ key, color }) => {
              const ms = metrics[key];
              if (!ms || ms <= 0 || ms > axisMs) return null;
              const pct = (ms / axisMs) * 100;
              return (
                <div
                  key={key}
                  className="absolute top-0 bottom-0 w-px pointer-events-none z-10"
                  style={{ left: `${pct}%`, background: color, opacity: 0.6 }}
                />
              );
            })}
          </div>

          {rows.map((req, i) => (
            <WaterfallRow
              key={req.url + i}
              req={req}
              index={i}
              axisMs={axisMs}
              isSelected={selectedIdx === i}
              onSelect={() => handleSelect(i)}
              onDeselect={handleDeselect}
              rowRef={el  => { rowRefs.current[i]  = el; }}
              ttfbRef={el => { ttfbRefs.current[i] = el; }}
              dlRef={el   => { dlRefs.current[i]   = el; }}
              shimRef={el => { shimRefs.current[i] = el; }}
            />
          ))}
        </div>

        {ctx && (
          <div
            ref={indicatorRef}
            aria-hidden
            className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-20 [will-change:transform]"
            style={{
              transform: `translateX(${LEFT_W}px)`,
              background: 'linear-gradient(to bottom, var(--ld-accent) 0%, rgba(20,192,138,0.4) 80%, transparent 100%)',
            }}
          >
            <div className="absolute -top-px left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div className="w-2 h-2 rounded-full ring-2 bg-ld-accent shadow-[0_0_8px_var(--ld-accent)] ring-[var(--ld-accent-line)]" />
              <span
                ref={labelRef}
                className="mt-0.5 text-[9px] font-mono font-bold tabular-nums whitespace-nowrap px-1 py-px rounded border select-none text-ld-accent bg-ld-surface border-ld-accent-line"
              >
                0ms
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="px-[18px] py-[10px] border-t border-ld-border bg-ld-bg flex items-center justify-between">
        <p className="text-[10.5px] text-ld-text-3">
          {ctx
            ? 'Scrub the Performance Timeline to animate the waterfall. Click a row for details.'
            : 'Click a row for timing details.'}
        </p>
        {selectedIdx !== null && (
          <button
            onClick={handleDeselect}
            className="text-[11px] text-ld-text-3 hover:text-ld-text transition-colors cursor-pointer"
          >
            Close detail
          </button>
        )}
      </div>
    </div>
  );
}
