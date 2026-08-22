import { useMemo, useState, useCallback } from 'react';
import { Network } from 'lucide-react';
import { fmtMsOrDash as fmtMs } from '@/shared/lib/format';
import { PanelHeader, Chip } from '@/shared/ui/panel';
import { useTimelineContext } from '../model/TimelineContext';
import { useWaterfallPlayhead } from '../model/useWaterfallPlayhead';
import { MAX_ROWS, TICK_COUNT } from '../lib/waterfall';
import { buildChangeMap } from '../lib/resourceChange';
import { WaterfallRow } from './WaterfallRow';
import { METRIC_MARKERS } from '@/entities/analysis';
import type { ParsedResources, NetworkRequest, ResourceType, CoreWebVitals, ResourceDiff } from '@/entities/analysis';

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
  changes,
}: {
  resources:         ParsedResources;
  timelineDuration?: number;
  metrics?:          CoreWebVitals;
  showHeader?:       boolean;
  /** What moved since the previous run, for the per-row tags. */
  changes?:          ResourceDiff | undefined;
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

  const changeMap = useMemo(() => buildChangeMap(changes), [changes]);

  const wfMs   = useMemo(() => allRows.reduce((mx, r) => Math.max(mx, r.endTime), 0), [allRows]);
  const axisMs = (timelineDuration && timelineDuration > 0) ? timelineDuration : wfMs;

  const hasTimingData = allRows.length > 0 && wfMs > 0;

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const handleSelect   = useCallback((i: number) => setSelectedIdx(p => p === i ? null : i), []);
  const handleDeselect = useCallback(() => setSelectedIdx(null), []);

  // Playhead line, live label and per-row load states — driven by the shared timeline
  // clock when one is provided; a standalone waterfall (no ctx) stays static.
  const {
    rootRef, rowsLineRef: indicatorRef, labelRef,
    rowRefs, ttfbRefs, dlRefs, shimRefs,
  } = useWaterfallPlayhead({
    rows, axisMs, leftW: LEFT_W,
    motionMs: ctx && hasTimingData ? ctx.motionMs : null,
    networkOffset: ctx?.networkOffset,
  });

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
              leftW={LEFT_W}
              barStyle="typed"
              change={changeMap.get(req.url)}
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
