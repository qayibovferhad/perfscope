import {
  useRef, useEffect, useMemo, memo, useState, useLayoutEffect, useCallback,
} from 'react';
import { FileCode2, Palette, ImageIcon, Type, Globe, Network, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTimelineContext } from '../context/TimelineContext';
import type { ParsedResources, NetworkRequest, ResourceType } from '../types';

const LEFT_W     = 320;
const MAX_ROWS   = 120;
const TICK_COUNT = 6;

const TYPE_CFG: Record<
  ResourceType,
  { label: string; icon: React.ElementType; barLight: string; barDark: string; badge: string }
> = {
  script:     { label: 'JS',    icon: FileCode2, barLight: 'bg-indigo-400',  barDark: 'bg-indigo-600',  badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'   },
  stylesheet: { label: 'CSS',   icon: Palette,   barLight: 'bg-violet-400',  barDark: 'bg-violet-600',  badge: 'bg-violet-500/20 text-violet-400 border-violet-500/30'   },
  image:      { label: 'IMG',   icon: ImageIcon, barLight: 'bg-emerald-400', barDark: 'bg-emerald-600', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  font:       { label: 'FONT',  icon: Type,      barLight: 'bg-amber-400',   barDark: 'bg-amber-600',   badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30'       },
  document:   { label: 'DOC',   icon: FileCode2, barLight: 'bg-sky-400',     barDark: 'bg-sky-600',     badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30'             },
  media:      { label: 'MEDIA', icon: ImageIcon, barLight: 'bg-pink-400',    barDark: 'bg-pink-600',    badge: 'bg-pink-500/20 text-pink-400 border-pink-500/30'          },
  other:      { label: 'XHR',   icon: Globe,     barLight: 'bg-slate-400',   barDark: 'bg-slate-600',   badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30'       },
};

function fmtBytes(b: number): string {
  if (b <= 0) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

function fmtMs(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function resourceFilename(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.at(-1) || u.hostname;
  } catch {
    return url.split('/').pop() || url;
  }
}

function DetailPanel({ req, onClose }: { req: NetworkRequest; onClose: () => void }) {
  const cfg      = TYPE_CFG[req.resourceType];
  const duration = req.endTime - req.startTime;
  const name     = resourceFilename(req.url);

  const stats = [
    { label: 'Start',     value: fmtMs(req.startTime),           mono: true },
    { label: 'End',       value: fmtMs(req.endTime),             mono: true },
    { label: 'Duration',  value: fmtMs(duration),                mono: true, bold: true },
    { label: 'TTFB',      value: fmtMs(req.ttfb),                mono: true },
    { label: 'Download',  value: fmtMs(req.contentDownloadTime), mono: true },
    { label: 'Transfer',  value: fmtBytes(req.transferSize),      mono: true, bold: true },
    { label: 'Resource',  value: fmtBytes(req.resourceSize),      mono: true },
    { label: 'MIME',      value: req.mimeType || '—',             mono: true },
    { label: 'Status',    value: req.statusCode ? String(req.statusCode) : '—', mono: true },
    { label: '3rd-party', value: req.isThirdParty ? 'Yes' : 'No' },
  ];

  return (
    <div className="absolute left-2 right-2 z-30 mt-0.5 rounded-lg border border-slate-600 bg-slate-800 shadow-2xl shadow-black/60 text-xs">
      <div className="flex items-start gap-2 px-3 py-2.5 border-b border-slate-700">
        <span className={cn('shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5', cfg.badge)}>
          {cfg.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 truncate" title={name}>{name}</p>
          <a
            href={req.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-slate-200 truncate mt-0.5 transition-colors"
            title={req.url}
          >
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{req.url}</span>
          </a>
        </div>
        <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-slate-200 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-3 py-2.5">
        {stats.map(({ label, value, mono, bold }) => (
          <div key={label} className="flex justify-between items-center gap-2">
            <span className="text-slate-500 shrink-0">{label}</span>
            <span className={cn('text-slate-200 tabular-nums', mono && 'font-mono', bold && 'font-semibold text-white')}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {duration > 0 && (
        <div className="px-3 pb-3 space-y-1">
          <div className="flex text-[9px] text-slate-500 justify-between">
            <span>TTFB ({fmtMs(req.ttfb)})</span>
            <span>Download ({fmtMs(req.contentDownloadTime)})</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-slate-700">
            <div className={cn('rounded-l-full', cfg.barLight)} style={{ width: `${Math.min((req.ttfb / duration) * 100, 100)}%` }} />
            <div className={cn('rounded-r-full flex-1', cfg.barDark)} />
          </div>
        </div>
      )}
    </div>
  );
}

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
  const cfg  = TYPE_CFG[req.resourceType];
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
          'flex items-center border-b border-slate-800/60 cursor-pointer select-none',
          'transition-[opacity,filter] duration-200 ease-in-out',
          'data-[state=pending]:opacity-[0.2] data-[state=pending]:grayscale',
          'data-[state=loading]:opacity-100',
          'data-[state=loaded]:opacity-100',
          index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/40',
          isSelected && 'ring-1 ring-inset ring-blue-500/40 bg-blue-950/20',
        )}
        style={{ willChange: 'opacity, filter' }}
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-r border-slate-800/60"
          style={{ width: LEFT_W }}
        >
          <Icon className="w-3 h-3 shrink-0 text-slate-500" />
          <span className="font-mono text-[11px] text-slate-300 truncate flex-1 leading-none" title={req.url}>
            {name}
          </span>
          <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded border font-mono shrink-0', cfg.badge)}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-slate-500 tabular-nums shrink-0 w-11 text-right font-mono">
            {fmtBytes(req.transferSize)}
          </span>
        </div>

        <div className="flex-1 relative h-7 flex items-center">
          <div className="absolute inset-x-0 h-px bg-slate-800/80" />
          {barWidth > 0 && (
            <div
              className="absolute h-3.5 rounded-sm flex overflow-hidden"
              style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
            >
              <div ref={ttfbRef} className={cn('h-full transition-opacity duration-150', cfg.barLight)} style={{ width: `${ttfbPct}%` }} />
              <div ref={dlRef} className={cn('h-full flex-1 transition-opacity duration-150', cfg.barDark)} />
              <div ref={shimRef} className="wf-shim absolute inset-0 rounded-sm pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {isSelected && <DetailPanel req={req} onClose={onDeselect} />}
    </div>
  );
});

function TimeAxis({ axisMs }: { axisMs: number }) {
  return (
    <div className="relative h-6">
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
          <div className="h-2 w-px bg-slate-700" />
          <span className="text-[9px] font-mono text-slate-500 tabular-nums mt-0.5">
            {fmtMs((i / TICK_COUNT) * axisMs)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ResourceWaterfall({
  resources,
  timelineDuration,
}: {
  resources:         ParsedResources;
  timelineDuration?: number;
}) {
  const ctx = useTimelineContext();

  const rows = useMemo<NetworkRequest[]>(() => {
    return resources.requests
      .filter(r => r.endTime > 0 && r.endTime < 600_000)
      .slice()
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, MAX_ROWS);
  }, [resources.requests]);

  const wfMs   = useMemo(() => rows.reduce((mx, r) => Math.max(mx, r.endTime), 0), [rows]);
  const axisMs = (timelineDuration && timelineDuration > 0) ? timelineDuration : wfMs;

  const axisMsRef = useRef(axisMs);
  axisMsRef.current = axisMs;

  const hasTimingData = rows.length > 0 && wfMs > 0;

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
      <div className="rounded-xl border border-slate-700/60 bg-slate-900 px-4 py-8 text-center">
        <Network className="w-5 h-5 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-500">No network timing data available for this analysis.</p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="rounded-xl border border-slate-700/60 bg-slate-900 overflow-hidden">
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
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%);
          animation: wf-shimmer 1.3s ease-in-out infinite;
        }
      `}</style>

      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 bg-slate-900/80">
        <Network className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200 tracking-tight">Network Waterfall</span>
        <span className="ml-auto text-[11px] text-slate-500 font-mono tabular-nums">
          {rows.length} requests · {fmtMs(wfMs)} total
        </span>
      </div>

      <div className="flex border-b border-slate-800 bg-slate-900/60 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        <div className="shrink-0 flex items-center gap-6 px-3 py-2 border-r border-slate-800" style={{ width: LEFT_W }}>
          <span>Resource</span>
          <span className="ml-auto">Type</span>
          <span className="w-11 text-right">Size</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <TimeAxis axisMs={axisMs} />
        </div>
      </div>

      <div className="relative">
        <div
          className="overflow-y-auto"
          style={{ maxHeight: 420, scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
        >
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LEFT_W, right: 0 }}>
            {Array.from({ length: TICK_COUNT - 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-slate-800/60"
                style={{ left: `${((i + 1) / TICK_COUNT) * 100}%` }}
              />
            ))}
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
            className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-20"
            style={{
              transform: `translateX(${LEFT_W}px)`,
              willChange: 'transform',
              background: 'linear-gradient(to bottom, #60a5fa 0%, #60a5fa88 80%, transparent 100%)',
            }}
          >
            <div className="absolute -top-px left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-blue-400 ring-2 ring-blue-400/30 shadow-lg shadow-blue-400/40" />
              <span
                ref={labelRef}
                className="mt-0.5 text-[9px] font-mono font-bold text-blue-300 tabular-nums whitespace-nowrap bg-slate-900/90 px-1 py-px rounded border border-blue-500/30 select-none"
              >
                0ms
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
        <p className="text-[10px] text-slate-600">
          {ctx
            ? 'Scrub the Performance Timeline to animate the waterfall. Click a row for details.'
            : 'Click a row for timing details.'}
        </p>
        {selectedIdx !== null && (
          <button onClick={handleDeselect} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
            Close detail
          </button>
        )}
      </div>
    </div>
  );
}
