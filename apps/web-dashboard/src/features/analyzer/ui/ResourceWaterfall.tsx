import {
  useRef, useEffect, useMemo, memo, useState, useLayoutEffect, useCallback,
} from 'react';
import { FileCode2, Palette, ImageIcon, Type, Globe, Network, X, ExternalLink } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { PanelHeader } from '@/shared/ui/panel/PanelHeader';
import { Chip } from '@/shared/ui/panel/Chip';
import { useTimelineContext } from '../context/TimelineContext';
import type { ParsedResources, NetworkRequest, ResourceType, CoreWebVitals } from '@/entities/analysis';

const LEFT_W     = 320;
const MAX_ROWS   = 120;
const TICK_COUNT = 6;

interface TypeCfg {
  label:       string;
  icon:        React.ElementType;
  barTtfb:     string;
  barDl:       string;
  badgeBg:     string;
  badgeText:   string;
  badgeBorder: string;
}

const TYPE_CFG: Record<ResourceType, TypeCfg> = {
  script:     { label: 'JS',    icon: FileCode2, barTtfb: 'rgba(99,102,241,0.5)',   barDl: 'rgba(99,102,241,1)',   badgeBg: 'rgba(99,102,241,.12)', badgeText: '#818cf8', badgeBorder: 'rgba(99,102,241,.3)'  },
  stylesheet: { label: 'CSS',   icon: Palette,   barTtfb: 'rgba(167,139,250,0.5)',  barDl: 'rgba(167,139,250,1)', badgeBg: 'rgba(167,139,250,.12)', badgeText: '#a78bfa', badgeBorder: 'rgba(167,139,250,.3)'  },
  image:      { label: 'IMG',   icon: ImageIcon, barTtfb: 'var(--ld-accent-soft)',  barDl: 'var(--ld-accent)',    badgeBg: 'var(--ld-accent-soft)', badgeText: 'var(--ld-accent)', badgeBorder: 'var(--ld-accent-line)'  },
  font:       { label: 'FONT',  icon: Type,      barTtfb: 'rgba(230,162,60,0.4)',   barDl: 'var(--ld-amber)',     badgeBg: 'rgba(230,162,60,.1)', badgeText: 'var(--ld-amber)', badgeBorder: 'rgba(230,162,60,.3)'  },
  document:   { label: 'DOC',   icon: FileCode2, barTtfb: 'rgba(56,189,248,0.4)',   barDl: 'rgba(56,189,248,1)',  badgeBg: 'rgba(56,189,248,.1)', badgeText: '#38bdf8', badgeBorder: 'rgba(56,189,248,.3)'  },
  media:      { label: 'MEDIA', icon: ImageIcon, barTtfb: 'rgba(244,114,182,0.4)',  barDl: 'rgba(244,114,182,1)', badgeBg: 'rgba(244,114,182,.1)', badgeText: '#f472b6', badgeBorder: 'rgba(244,114,182,.3)'  },
  other:      { label: 'XHR',   icon: Globe,     barTtfb: 'var(--ld-border-strong)', barDl: 'var(--ld-text-3)',  badgeBg: 'transparent',  badgeText: 'var(--ld-text-3)', badgeBorder: 'var(--ld-border-strong)'  },
};

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

const METRIC_MARKERS: { key: keyof CoreWebVitals; label: string; color: string }[] = [
  { key: 'fcp', label: 'FCP', color: 'var(--ld-teal)'  },
  { key: 'lcp', label: 'LCP', color: 'var(--ld-accent)' },
  { key: 'tti', label: 'TTI', color: 'var(--ld-amber)'  },
];

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

// ─── Detail panel ─────────────────────────────────────────────────────────────

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
    <div className="absolute left-2 right-2 z-30 mt-0.5 rounded-[12px] border border-ld-border-strong bg-ld-surface-2 shadow-ld-shadow-card text-xs">
      <div className="flex items-start gap-2 px-3 py-2.5 border-b border-ld-border">
        <span
          className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5"
          style={{ background: cfg.badgeBg, color: cfg.badgeText, borderColor: cfg.badgeBorder }}
        >
          {cfg.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ld-text truncate" title={name}>{name}</p>
          <a
            href={req.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-ld-text-3 hover:text-ld-text truncate mt-0.5 transition-colors"
            title={req.url}
          >
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{req.url}</span>
          </a>
        </div>
        <button onClick={onClose} className="shrink-0 text-ld-text-3 hover:text-ld-text transition-colors cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-3 py-2.5">
        {stats.map(({ label, value, mono, bold }) => (
          <div key={label} className="flex justify-between items-center gap-2">
            <span className="text-ld-text-3 shrink-0">{label}</span>
            <span className={cn('text-ld-text-2 tabular-nums', mono && 'font-mono', bold && 'font-semibold text-ld-text')}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {duration > 0 && (
        <div className="px-3 pb-3 space-y-1">
          <div className="flex text-[9px] text-ld-text-3 justify-between">
            <span>TTFB ({fmtMs(req.ttfb)})</span>
            <span>Download ({fmtMs(req.contentDownloadTime)})</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-ld-border">
            <div
              className="rounded-l-full"
              style={{ width: `${Math.min((req.ttfb / duration) * 100, 100)}%`, backgroundColor: cfg.barTtfb }}
            />
            <div className="rounded-r-full flex-1" style={{ backgroundColor: cfg.barDl }} />
          </div>
        </div>
      )}
    </div>
  );
}

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
          'flex items-center border-b border-ld-border cursor-pointer select-none',
          'transition-[opacity,filter] duration-200 ease-in-out',
          'data-[state=pending]:opacity-20 data-[state=pending]:grayscale',
          index % 2 === 0 ? 'bg-ld-surface' : 'bg-ld-bg',
          isSelected && 'ring-1 ring-inset ring-ld-accent-line bg-ld-accent-soft',
        )}
        style={{ willChange: 'opacity, filter' }}
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
            style={{ background: cfg.badgeBg, color: cfg.badgeText, borderColor: cfg.badgeBorder }}
          >
            {cfg.label}
          </span>
          <span className="text-[10px] text-ld-text-3 tabular-nums shrink-0 w-11 text-right font-mono">
            {fmtBytes(req.transferSize)}
          </span>
        </div>

        <div className="flex-1 relative h-7 flex items-center">
          <div className="absolute inset-x-0 h-px" style={{ background: 'var(--ld-border)' }} />
          {barWidth > 0 && (
            <div
              className="absolute h-3.5 rounded-sm flex overflow-hidden"
              style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
            >
              <div
                ref={ttfbRef}
                className="h-full transition-opacity duration-150"
                style={{ width: `${ttfbPct}%`, backgroundColor: cfg.barTtfb }}
              />
              <div
                ref={dlRef}
                className="h-full flex-1 transition-opacity duration-150"
                style={{ backgroundColor: cfg.barDl }}
              />
              <div ref={shimRef} className="wf-shim absolute inset-0 rounded-sm pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {isSelected && <DetailPanel req={req} onClose={onDeselect} />}
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
          <div className="h-2 w-px" style={{ background: 'var(--ld-border-strong)' }} />
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
            <span className="text-[8.5px] font-mono font-bold tabular-nums px-1 py-px rounded" style={{ color, background: 'var(--ld-surface)' }}>
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
}: {
  resources:         ParsedResources;
  timelineDuration?: number;
  metrics?:          CoreWebVitals;
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
        <div
          className="overflow-y-auto"
          style={{ maxHeight: 420, scrollbarWidth: 'thin', scrollbarColor: 'var(--ld-border-strong) transparent' }}
        >
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LEFT_W, right: 0 }}>
            {Array.from({ length: TICK_COUNT - 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px"
                style={{ left: `${((i + 1) / TICK_COUNT) * 100}%`, background: 'var(--ld-border)' }}
              />
            ))}

            {metrics && METRIC_MARKERS.map(({ key, label, color }) => {
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
            className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-20"
            style={{
              transform: `translateX(${LEFT_W}px)`,
              willChange: 'transform',
              background: 'linear-gradient(to bottom, var(--ld-accent) 0%, rgba(20,192,138,0.4) 80%, transparent 100%)',
            }}
          >
            <div className="absolute -top-px left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div
                className="w-2 h-2 rounded-full ring-2"
                style={{ backgroundColor: 'var(--ld-accent)', boxShadow: '0 0 8px var(--ld-accent)', borderColor: 'var(--ld-accent-line)' }}
              />
              <span
                ref={labelRef}
                className="mt-0.5 text-[9px] font-mono font-bold tabular-nums whitespace-nowrap px-1 py-px rounded border select-none"
                style={{ color: 'var(--ld-accent)', background: 'var(--ld-surface)', borderColor: 'var(--ld-accent-line)' }}
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
