import {
  useRef, useEffect, useMemo, memo, useState, useLayoutEffect, useCallback,
} from 'react';
import {
  FileCode2, Palette, ImageIcon, Type, Globe,
  Network, X, ExternalLink, Play, Pause,
} from 'lucide-react';
import { useMotionValue, useTransform, motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { fmtMsOrDash as fmtMs, fmtBytesOrDash as fmtBytes, fmtSec2 } from '@/shared/lib/format';
import { useTimelineContext } from '../model/TimelineContext';
import { FlameChart } from './FlameChart';
import type {
  ParsedResources, NetworkRequest, ResourceType, TimelineData, TimelineFrame,
  FlameChartData,
} from '@/entities/analysis';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEFT_W     = 280;
const MAX_ROWS   = 120;
const TICK_COUNT = 6;
const TICK_MS    = 50;

// chipCls   — metric chip in the panel head
// labelCls  — small label above the scrubber track
// lineCls   — vertical tick on the scrubber track + row markers
const METRICS_CFG = [
  {
    key: 'fcp' as const, label: 'FCP',
    chipCls:  'text-ld-teal border border-[rgba(22,200,200,.30)] bg-[rgba(22,200,200,.08)]',
    labelCls: 'text-ld-teal border border-[rgba(22,200,200,.40)] bg-ld-surface',
    lineCls:  'bg-ld-teal',
  },
  {
    key: 'lcp' as const, label: 'LCP',
    chipCls:  'text-[var(--ld-accent-2)] border border-ld-accent-line bg-ld-accent-soft',
    labelCls: 'text-ld-accent border border-ld-accent-line bg-ld-surface',
    lineCls:  'bg-ld-accent',
  },
  {
    key: 'tti' as const, label: 'TTI',
    chipCls:  'text-ld-amber border border-[rgba(230,162,60,.30)] bg-[rgba(230,162,60,.08)]',
    labelCls: 'text-ld-amber border border-[rgba(230,162,60,.40)] bg-ld-surface',
    lineCls:  'bg-ld-amber',
  },
] as const;

interface TypeCfg {
  label:     string;
  icon:      React.ElementType;
  barWaitCls: string;
  badgeCls:  string;
}

// Badge colors follow the shared resource palette (see ResourceWaterfall):
// script indigo, stylesheet violet, image accent, font amber, document sky, media pink.
const TYPE_CFG: Record<ResourceType, TypeCfg> = {
  script:     { label: 'JS',    icon: FileCode2, barWaitCls: 'bg-ld-border-strong',  badgeCls: 'text-[#818cf8] bg-[rgba(99,102,241,.12)]  border border-[rgba(99,102,241,.3)]'  },
  stylesheet: { label: 'CSS',   icon: Palette,   barWaitCls: 'bg-ld-border-strong',  badgeCls: 'text-[#a78bfa] bg-[rgba(167,139,250,.12)] border border-[rgba(167,139,250,.3)]' },
  image:      { label: 'IMG',   icon: ImageIcon, barWaitCls: 'bg-ld-accent-soft',    badgeCls: 'text-[var(--ld-accent-2)] bg-ld-accent-soft border border-ld-accent-line'        },
  font:       { label: 'FONT',  icon: Type,      barWaitCls: 'bg-ld-border-strong',  badgeCls: 'text-ld-amber  bg-[rgba(230,162,60,.1)]   border border-[rgba(230,162,60,.3)]'  },
  document:   { label: 'DOC',   icon: FileCode2, barWaitCls: 'bg-ld-accent-line',    badgeCls: 'text-[#38bdf8] bg-[rgba(56,189,248,.1)]   border border-[rgba(56,189,248,.3)]'  },
  media:      { label: 'MEDIA', icon: ImageIcon, barWaitCls: 'bg-ld-border-strong',  badgeCls: 'text-[#f472b6] bg-[rgba(244,114,182,.10)] border border-[rgba(244,114,182,.30)]' },
  other:      { label: 'XHR',   icon: Globe,     barWaitCls: 'bg-ld-border',         badgeCls: 'text-ld-text-3 bg-transparent              border border-ld-border-strong'        },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resourceFilename(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.at(-1) || u.hostname;
  } catch {
    return url.split('/').pop() || url;
  }
}

function findClosestFrameIndex(frames: TimelineFrame[], targetMs: number): number {
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].timing < targetMs) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(frames[lo - 1].timing - targetMs) < Math.abs(frames[lo].timing - targetMs)) {
    return lo - 1;
  }
  return lo;
}

// ─── DetailPanel ──────────────────────────────────────────────────────────────

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
    { label: 'Transfer',  value: fmtBytes(req.transferSize),     mono: true, bold: true },
    { label: 'Resource',  value: fmtBytes(req.resourceSize),     mono: true },
    { label: 'MIME',      value: req.mimeType || '—',            mono: true },
    { label: 'Status',    value: req.statusCode ? String(req.statusCode) : '—', mono: true },
    { label: '3rd-party', value: req.isThirdParty ? 'Yes' : 'No' },
  ];

  return (
    <div className="absolute left-2 right-2 z-30 mt-0.5 rounded-[12px] border border-ld-border-strong bg-ld-surface-2 shadow-ld-shadow-card text-xs">
      <div className="flex items-start gap-2 px-3 py-2.5 border-b border-ld-border">
        <span className={cn('shrink-0 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded mt-0.5', cfg.badgeCls)}>
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
              className={cn('rounded-l-full', cfg.barWaitCls)}
              style={{ width: `${Math.min((req.ttfb / duration) * 100, 100)}%` }}
            />
            <div className="rounded-r-full flex-1 bg-ld-accent" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WaterfallRow ─────────────────────────────────────────────────────────────

interface RowProps {
  req:        NetworkRequest;
  index:      number;
  axisMs:     number;
  isSelected: boolean;
  onSelect:   () => void;
  onDeselect: () => void;
  rowRef:  (el: HTMLDivElement | null) => void;
  ttfbRef: (el: HTMLDivElement | null) => void;
  dlRef:   (el: HTMLDivElement | null) => void;
  shimRef: (el: HTMLDivElement | null) => void;
}

const WaterfallRow = memo(function WaterfallRow({
  req, index, axisMs, isSelected, onSelect, onDeselect,
  rowRef, ttfbRef, dlRef, shimRef,
}: RowProps) {
  const ctx  = useTimelineContext();
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
        onMouseEnter={() => ctx?.hoveredUrl.set(req.url)}
        onMouseLeave={() => ctx?.hoveredUrl.set('')}
        className={cn(
          'flex items-center border-b border-ld-border cursor-pointer select-none',
          'transition-[opacity,filter] duration-200 ease-in-out [will-change:opacity,filter]',
          'data-[state=pending]:opacity-20 data-[state=pending]:grayscale',
          index % 2 === 0 ? 'bg-ld-surface' : 'bg-ld-bg',
          isSelected && 'ring-1 ring-inset ring-ld-accent-line bg-ld-accent-soft',
        )}
      >
        {/* Name column */}
        <div className="w-[280px] flex items-center gap-2 px-3 py-1 shrink-0 border-r border-ld-border">
          <Icon className="w-3 h-3 shrink-0 text-ld-text-3" />
          <span className="font-mono text-[11px] text-ld-text-2 truncate flex-1 leading-none" title={req.url}>
            {name}
          </span>
          <span className={cn('text-[9.5px] font-semibold font-mono px-[6px] py-[2px] rounded-[5px] shrink-0', cfg.badgeCls)}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-ld-text-3 tabular-nums shrink-0 w-11 text-right font-mono">
            {fmtBytes(req.transferSize)}
          </span>
        </div>

        {/* Lane */}
        <div className="flex-1 relative h-5 flex items-center">
          <div className="absolute inset-x-0 h-px bg-ld-border" />
          {barWidth > 0 && (
            <div
              className="absolute h-2.5 rounded-sm flex overflow-hidden"
              style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
            >
              <div
                ref={ttfbRef}
                className={cn('h-full transition-opacity duration-150', cfg.barWaitCls)}
                style={{ width: `${ttfbPct}%` }}
              />
              <div ref={dlRef} className="h-full flex-1 transition-opacity duration-150 bg-ld-accent" />
              <div ref={shimRef} className="wf-shim absolute inset-0 rounded-sm pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {isSelected && <DetailPanel req={req} onClose={onDeselect} />}
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export function TimelineWaterfall({
  resources,
  timelineData,
  flameChartData,
}: {
  resources:       ParsedResources;
  timelineData:    TimelineData;
  flameChartData?: FlameChartData;
}) {
  const ctx = useTimelineContext();
  const { frames, metrics, networkOffsetMs } = timelineData;
  const maxTiming = frames.at(-1)!.timing;

  // ── Waterfall rows
  const rows = useMemo<NetworkRequest[]>(() =>
    resources.requests
      .filter(r => r.endTime > 0 && r.endTime < 600_000)
      .slice()
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, MAX_ROWS),
  [resources.requests]);

  const wfMs    = useMemo(() => rows.reduce((mx, r) => Math.max(mx, r.endTime), 0), [rows]);
  const axisMs  = maxTiming > 0 ? maxTiming : wfMs;
  const axisMsRef = useRef(axisMs);
  axisMsRef.current = axisMs;

  // ── UI state
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [playSpeed,      setPlaySpeed]      = useState<0.5 | 1>(1);
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [selectedIdx,    setSelectedIdx]    = useState<number | null>(null);

  const handleSelect   = useCallback((i: number) => setSelectedIdx(p => p === i ? null : i), []);
  const handleDeselect = useCallback(() => setSelectedIdx(null), []);

  // ── MotionValues for scrubber
  const motionMs      = useMotionValue(0);
  const progressWidth = useTransform(motionMs, [0, maxTiming], ['0%', '100%']);
  const playheadLeft  = useTransform(motionMs, [0, maxTiming], ['0%', '100%']);

  // ── DOM refs
  const rootRef     = useRef<HTMLDivElement>(null);
  const rangeRef    = useRef<HTMLInputElement>(null);
  const rowsLineRef = useRef<HTMLDivElement>(null);
  const axisLineRef = useRef<HTMLDivElement>(null);
  const curLabelRef = useRef<HTMLSpanElement>(null);
  const chartWRef   = useRef(0);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const playTimeRef  = useRef(0);
  const playSpeedRef = useRef(playSpeed);
  const prevFrIdxRef = useRef(0);

  const rowRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const ttfbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dlRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const shimRefs = useRef<(HTMLDivElement | null)[]>([]);

  rowRefs.current.length  = rows.length;
  ttfbRefs.current.length = rows.length;
  dlRefs.current.length   = rows.length;
  shimRefs.current.length = rows.length;

  useEffect(() => { playSpeedRef.current = playSpeed; }, [playSpeed]);

  useEffect(() => {
    if (ctx) {
      ctx.maxTiming.current     = maxTiming;
      ctx.networkOffset.current = networkOffsetMs;
    }
  }, [ctx, maxTiming, networkOffsetMs]);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const update = () => { chartWRef.current = (rootRef.current?.clientWidth ?? 0) - LEFT_W; };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  const handleScrubInternal = useCallback((ms: number) => {
    motionMs.set(ms);
    ctx?.motionMs.set(ms);
    if (rangeRef.current) rangeRef.current.value = String(ms);
    const newIdx = findClosestFrameIndex(frames, ms);
    if (newIdx !== prevFrIdxRef.current) {
      prevFrIdxRef.current = newIdx;
      setActiveFrameIdx(newIdx);
    }
  }, [frames, motionMs, ctx]);

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playTimeRef.current >= maxTiming) { playTimeRef.current = 0; handleScrubInternal(0); }
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      playTimeRef.current = Math.min(playTimeRef.current + TICK_MS * playSpeedRef.current, maxTiming);
      handleScrubInternal(playTimeRef.current);
      if (playTimeRef.current >= maxTiming) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsPlaying(false);
      }
    }, TICK_MS);
  }, [maxTiming, handleScrubInternal]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const togglePlay  = useCallback(() => isPlaying ? stopPlayback() : startPlayback(), [isPlaying, startPlayback, stopPlayback]);
  const handleScrub = useCallback((ms: number) => {
    stopPlayback();
    playTimeRef.current = ms;
    handleScrubInternal(ms);
  }, [stopPlayback, handleScrubInternal]);

  // ── MotionValue subscriber → imperatively update ghost lines + row states
  useEffect(() => {
    const unsub = motionMs.on('change', (sliderMs) => {
      const axMs   = axisMsRef.current;
      const netOff = ctx?.networkOffset.current ?? 0;
      const pct    = Math.min(Math.max(sliderMs / axMs, 0), 1);
      const chartW = chartWRef.current;

      if (rowsLineRef.current) {
        rowsLineRef.current.style.transform = `translateX(${(LEFT_W + chartW * pct).toFixed(1)}px)`;
      }
      if (axisLineRef.current) {
        axisLineRef.current.style.transform = `translateX(${(chartW * pct).toFixed(1)}px)`;
      }
      if (curLabelRef.current) {
        curLabelRef.current.textContent = fmtMs(sliderMs);
      }

      for (let i = 0; i < rows.length; i++) {
        const rowEl = rowRefs.current[i];
        if (!rowEl) continue;
        const { startTime, endTime, ttfb } = rows[i];
        const fStart = startTime + netOff;
        const fEnd   = endTime   + netOff;
        const state  = sliderMs < fStart ? 'pending' : sliderMs >= fEnd ? 'loaded' : 'loading';
        if (rowEl.dataset.state !== state) {
          rowEl.dataset.state = state;
          shimRefs.current[i]?.classList.toggle('wf-shim-active', state === 'loading');
        }
        const ttfbEl = ttfbRefs.current[i];
        const dlEl   = dlRefs.current[i];
        if (state === 'loading') {
          if (ttfbEl) ttfbEl.style.opacity = '1';
          if (dlEl)   dlEl.style.opacity   = sliderMs >= fStart + ttfb ? '1' : '0.3';
        } else {
          if (ttfbEl) ttfbEl.style.opacity = '1';
          if (dlEl)   dlEl.style.opacity   = '1';
        }
      }
    });
    return unsub;
  }, [ctx, rows, motionMs]);

  useEffect(() => {
    for (const f of frames) { const img = new Image(); img.src = f.data; }
  }, [frames]);

  const axisTicks = useMemo(() =>
    Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
      const ms  = (i / TICK_COUNT) * axisMs;
      const idx = findClosestFrameIndex(frames, ms);
      return { i, ms, frame: frames[idx] };
    }),
  [axisMs, frames]);

  if (rows.length === 0 || wfMs === 0) {
    return (
      <div className="rounded-[18px] border border-ld-border bg-ld-surface shadow-ld-shadow-card px-4 py-8 text-center">
        <Network className="w-5 h-5 text-ld-text-3 mx-auto mb-2" />
        <p className="text-[12.5px] text-ld-text-3">No network timing data available.</p>
      </div>
    );
  }

  // AXIS_ROW_H = top-pad(8) + thumb(45) + tick-line(6) + label(16) + bottom-pad(8) = 83
  const AXIS_ROW_H = 83;

  return (
    <div ref={rootRef} className="rounded-[18px] border border-ld-border bg-ld-surface shadow-ld-shadow-card overflow-hidden">
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

      {/* ══════════ STICKY HEADER ══════════════════════════════════════════ */}
      <div className="sticky top-0 z-50 bg-ld-surface rounded-t-[18px] border-b border-ld-border">

        {/* ── Panel head ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-[10px] px-[18px] py-[14px] flex-wrap">

          {/* Icon tile */}
          <span className="w-[34px] h-[34px] rounded-[9px] grid place-items-center bg-ld-surface-2 border border-ld-border [&_svg]:w-[17px] [&_svg]:h-[17px] text-ld-accent shrink-0">
            <Network />
          </span>

          <h3 className="text-[16.5px] font-bold text-ld-text tracking-tight">Network Waterfall</h3>
          <span className="font-mono text-[12px] text-ld-text-3">{rows.length} req · {fmtMs(wfMs)}</span>

          {/* Controls */}
          <div className="flex items-center gap-[8px]">
            <button
              onClick={togglePlay}
              className="flex items-center gap-[6px] px-[10px] py-[6px] rounded-[8px] bg-ld-accent-soft hover:bg-ld-accent-line border border-ld-accent-line text-ld-accent text-[12px] font-semibold transition-colors shrink-0 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <div className="flex rounded-[8px] overflow-hidden border border-ld-border text-[11px] font-mono shrink-0">
              {([0.5, 1] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setPlaySpeed(s)}
                  className={cn(
                    'px-[8px] py-[5px] transition-colors cursor-pointer',
                    playSpeed === s
                      ? 'bg-ld-accent-soft text-ld-accent font-semibold'
                      : 'text-ld-text-3 hover:text-ld-text-2 bg-transparent',
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>

            <span
              ref={curLabelRef}
              className="text-[11px] font-mono font-bold tabular-nums px-[8px] py-[5px] rounded-[7px] border border-ld-accent-line bg-ld-accent-soft text-ld-accent shrink-0"
            >
              0ms
            </span>
            <span className="text-[10px] text-ld-text-3 font-mono shrink-0">/ {fmtMs(maxTiming)}</span>
          </div>

          {/* Right: metric chips + video */}
          <div className="ml-auto flex items-center gap-[8px]">
            {METRICS_CFG.map(m => {
              const val = metrics[m.key];
              if (!val) return null;
              return (
                <span
                  key={m.key}
                  className={cn(
                    'inline-flex items-center gap-[6px] font-mono text-[11px] font-semibold px-[9px] py-[4px] rounded-[7px]',
                    m.chipCls,
                  )}
                >
                  <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-current" />
                  {m.label} {fmtSec2(val)}
                </span>
              );
            })}

            {/* Mini video */}
            <div className="relative w-[120px] h-[68px] rounded-[10px] overflow-hidden border border-ld-border-strong bg-ld-bg shrink-0">
              <img
                src={frames[activeFrameIdx].data}
                alt=""
                className="w-full h-full object-contain"
                draggable={false}
              />
              <div className="absolute bottom-1 right-1 text-[8px] font-mono text-ld-text-3 bg-ld-surface/80 px-1 rounded tabular-nums">
                {fmtSec2(frames[activeFrameIdx].timing)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrubber ─────────────────────────────────────────────────── */}
        <div className="pb-3 pl-[298px] pr-[18px]">

          {/* Metric labels above track */}
          <div className="relative h-5 mb-0.5">
            {METRICS_CFG.map(m => {
              const val = metrics[m.key];
              if (!val) return null;
              return (
                <div
                  key={m.key}
                  className="absolute bottom-0 flex flex-col items-center gap-0.5 -translate-x-1/2 pointer-events-none"
                  style={{ left: `${(val / maxTiming) * 100}%` }}
                >
                  <div className={cn('flex items-center gap-0.5 px-1 rounded text-[9px] font-bold font-mono border', m.labelCls)}>
                    {m.label}
                  </div>
                  <div className={cn('w-px h-1.5', m.lineCls)} />
                </div>
              );
            })}
          </div>

          {/* Track */}
          <div className="relative h-4 flex items-center">
            <div className="absolute inset-x-0 h-1 rounded-full bg-ld-border-strong" />
            <motion.div
              className="absolute left-0 h-1 rounded-full bg-ld-accent"
              style={{ width: progressWidth }}
            />
            {METRICS_CFG.map(m => {
              const val = metrics[m.key];
              if (!val) return null;
              return (
                <div
                  key={m.key}
                  className={cn('absolute w-0.5 h-3 rounded-full -translate-x-1/2 pointer-events-none z-10', m.lineCls)}
                  style={{ left: `${(val / maxTiming) * 100}%` }}
                />
              );
            })}
            <motion.div
              className="absolute w-3.5 h-3.5 rounded-full shadow-lg -translate-x-1/2 z-20 border-2 bg-ld-accent border-ld-accent-2 [box-shadow:0_0_10px_var(--ld-accent)]"
              style={{ left: playheadLeft }}
            />
            <input
              ref={rangeRef}
              type="range"
              defaultValue={0}
              min={0}
              max={maxTiming}
              step={1}
              onChange={e => handleScrub(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer z-30"
            />
          </div>
        </div>

        {/* ── Column headers + filmstrip axis ──────────────────────────── */}
        <div className="flex border-t border-ld-border text-[10px] font-semibold uppercase tracking-widest text-ld-text-3">
          <div
            className="w-[280px] shrink-0 flex items-center gap-4 px-3 border-r border-ld-border"
            style={{ height: AXIS_ROW_H }}
          >
            <span>Resource</span>
            <span className="ml-auto">Type</span>
            <span className="w-11 text-right">Size</span>
          </div>

          <div className="flex-1 relative overflow-hidden" style={{ height: AXIS_ROW_H }}>
            {axisTicks.map(({ i, ms, frame }) => (
              <div
                key={i}
                className={cn(
                  'absolute top-2 flex flex-col',
                  i === 0 ? 'items-start translate-x-0' :
                  i === TICK_COUNT ? 'items-end -translate-x-full' :
                  'items-center -translate-x-1/2',
                )}
                style={{ left: `${(i / TICK_COUNT) * 100}%` }}
              >
                <img
                  src={frame.data}
                  alt=""
                  className="w-[80px] h-[45px] rounded-[5px] border border-ld-border object-cover opacity-80"
                  draggable={false}
                />
                <div className="h-1.5 w-px mt-0.5 bg-ld-border-strong" />
                <span className="text-[9px] font-mono text-ld-text-3 tabular-nums mt-0.5 normal-case tracking-normal font-normal">
                  {fmtMs(ms)}
                </span>
              </div>
            ))}

            {/* Axis ghost line — transform set imperatively */}
            <div
              ref={axisLineRef}
              className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-10 will-change-transform bg-gradient-to-b from-ld-accent to-[rgba(20,192,138,.4)]"
              style={{ transform: 'translateX(0)' }}
            />
          </div>
        </div>
      </div>

      {/* ══════════ WATERFALL ROWS ═════════════════════════════════════════ */}
      <div className="rounded-b-[18px] overflow-hidden bg-ld-bg">
        <div className="relative">

          {/* Grid lines + metric markers */}
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LEFT_W, right: 0 }}>
            {Array.from({ length: TICK_COUNT - 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-ld-border"
                style={{ left: `${((i + 1) / TICK_COUNT) * 100}%` }}
              />
            ))}

            {METRICS_CFG.map(m => {
              const val = metrics[m.key];
              if (!val) return null;
              const pct = Math.min(val / axisMs, 1) * 100;
              return (
                <div
                  key={m.key}
                  className={cn('absolute top-0 bottom-0 w-0.5 pointer-events-none z-10 opacity-50', m.lineCls)}
                  style={{ left: `${pct}%` }}
                />
              );
            })}
          </div>

          {/* Rows */}
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

          {/* Rows ghost line — transform set imperatively */}
          <div
            ref={rowsLineRef}
            aria-hidden
            className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-20 will-change-transform bg-gradient-to-b from-ld-accent via-[rgba(20,192,138,.5)] to-transparent"
            style={{ transform: `translateX(${LEFT_W}px)` }}
          >
            <div className="absolute -top-px left-1/2 -translate-x-1/2">
              <div className="w-2 h-2 rounded-full bg-ld-accent ring-2 ring-ld-accent-line [box-shadow:0_0_8px_var(--ld-accent)]" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-[18px] py-[10px] border-t border-ld-border flex items-center justify-between">
          <p className="text-[10.5px] text-ld-text-3">
            Scrub the timeline or press Play to animate · Click a row for details
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

        {/* ── CPU FLAME CHART ──────────────────────────────────────────── */}
        {flameChartData && flameChartData.events.length > 0 && (
          <div className="border-t border-ld-border">
            <div className="flex items-center gap-[10px] px-[18px] py-[12px] border-b border-ld-border">
              <span className="w-[28px] h-[28px] rounded-[7px] grid place-items-center border shrink-0 text-ld-amber bg-[rgba(230,162,60,.12)] border-[rgba(230,162,60,.3)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </span>
              <span className="text-[14px] font-bold text-ld-text tracking-tight">CPU Main Thread</span>
              <span className="font-mono text-[11px] text-ld-text-3">
                {flameChartData.events.length} events ·{' '}
                {flameChartData.events.filter(e => e.isLongTask).length} long tasks ·{' '}
                {flameChartData.maxDepth} call stack levels
              </span>
            </div>
            <FlameChart data={flameChartData} axisMs={axisMs} leftW={LEFT_W} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Loading placeholder
   ═══════════════════════════════════════════════════════════════════════════ */

/** One shimmering block — same emerald sweep the live bars use while pending. */
function WfShim({ className, delay = 0, style }: { className?: string; delay?: number; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('wf-sk-shim bg-ld-surface-2', className)}
      style={{ ...style, ['--wf-sk-delay' as string]: `${delay}ms` }}
    />
  );
}

/** Bar widths that read like a real request cascade rather than a uniform block. */
const SK_ROWS = [
  { left: 0,  width: 34 }, { left: 4,  width: 22 }, { left: 8,  width: 41 },
  { left: 12, width: 18 }, { left: 15, width: 29 }, { left: 22, width: 13 },
  { left: 26, width: 47 }, { left: 31, width: 20 }, { left: 38, width: 26 },
  { left: 44, width: 16 },
];

/**
 * Stands in for the whole panel while the audit is still streaming.
 * Built from the live component's own measurements — 18px shell, 280px resource
 * column, 83px axis row, 20px lanes — so nothing shifts when the data lands.
 */
export function TimelineWaterfallSkeleton() {
  return (
    <div className="rounded-[18px] border border-ld-border bg-ld-surface shadow-ld-shadow-card overflow-hidden">
      <style>{`
        @keyframes wf-sk-shimmer {
          0%   { transform: translateX(-100%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateX(250%); opacity: 0; }
        }
        .wf-sk-shim { position: relative; overflow: hidden; }
        .wf-sk-shim::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(20,192,138,0.22) 50%, transparent 100%);
          animation: wf-sk-shimmer 1.3s ease-in-out infinite;
          animation-delay: var(--wf-sk-delay, 0ms);
        }
      `}</style>

      {/* ── Panel head ─────────────────────────────────────────────────── */}
      <div className="border-b border-ld-border">
        <div className="flex items-center gap-[10px] px-[18px] py-[14px] flex-wrap">
          <span className="w-[34px] h-[34px] rounded-[9px] grid place-items-center bg-ld-surface-2 border border-ld-border [&_svg]:w-[17px] [&_svg]:h-[17px] text-ld-accent shrink-0">
            <Network />
          </span>
          <h3 className="text-[16.5px] font-bold text-ld-text tracking-tight">Network Waterfall</h3>
          <span className="font-mono text-[12px] text-ld-text-3">collecting requests…</span>

          <div className="flex items-center gap-[8px]">
            <WfShim className="h-[27px] w-[64px] rounded-[8px]" />
            <WfShim className="h-[25px] w-[62px] rounded-[8px]" delay={80} />
            <span className="text-[11px] font-mono font-bold tabular-nums px-[8px] py-[5px] rounded-[7px] border border-ld-accent-line bg-ld-accent-soft text-ld-accent shrink-0">
              0ms
            </span>
          </div>

          <div className="ml-auto flex items-center gap-[8px]">
            {METRICS_CFG.map((m, i) => (
              <span
                key={m.key}
                className={cn(
                  'hidden min-[900px]:inline-flex items-center gap-[6px] font-mono text-[11px] font-semibold px-[9px] py-[4px] rounded-[7px] opacity-50',
                  m.chipCls,
                )}
              >
                <span className={cn('w-[7px] h-[7px] rounded-full shrink-0 animate-pulse', m.lineCls)} style={{ animationDelay: `${i * 140}ms` }} />
                {m.label}
              </span>
            ))}
            <WfShim className="w-[120px] h-[68px] rounded-[10px] border border-ld-border-strong shrink-0" delay={160} />
          </div>
        </div>

        {/* ── Scrubber — aligned with the live one ─────────────────────── */}
        <div className="pb-3 pl-[298px] pr-[18px]">
          <div className="relative h-4 flex items-center">
            <div className="absolute inset-x-0 h-1 rounded-full bg-ld-border-strong overflow-hidden">
              <div className="wf-sk-shim h-full w-full bg-ld-border-strong" />
            </div>
            <div className="absolute left-0 w-3.5 h-3.5 rounded-full -translate-x-1/2 z-20 border-2 bg-ld-surface border-ld-border-strong" />
          </div>
        </div>

        {/* ── Column headers + filmstrip axis ─────────────────────────── */}
        <div className="flex border-t border-ld-border text-[10px] font-semibold uppercase tracking-widest text-ld-text-3">
          <div className="w-[280px] shrink-0 flex items-center gap-4 px-3 border-r border-ld-border" style={{ height: 83 }}>
            <span>Resource</span>
            <span className="ml-auto">Type</span>
            <span className="w-11 text-right">Size</span>
          </div>

          <div className="flex-1 relative overflow-hidden" style={{ height: 83 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'absolute top-2 flex flex-col',
                  i === 0 ? 'items-start translate-x-0' : i === 6 ? 'items-end -translate-x-full' : 'items-center -translate-x-1/2',
                )}
                style={{ left: `${(i / 6) * 100}%` }}
              >
                <WfShim className="w-[80px] h-[45px] rounded-[5px] border border-ld-border" delay={i * 70} />
                <div className="h-1.5 w-px mt-0.5 bg-ld-border-strong" />
                <WfShim className="w-6 h-2 rounded-[3px] mt-1" delay={i * 70} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Rows ───────────────────────────────────────────────────────── */}
      <div className="rounded-b-[18px] overflow-hidden bg-ld-bg">
        <div className="relative">
          {/* Grid lines, same 6 ticks as the live chart */}
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: 280, right: 0 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="absolute top-0 bottom-0 w-px bg-ld-border" style={{ left: `${((i + 1) / 6) * 100}%` }} />
            ))}
          </div>

          {SK_ROWS.map((r, i) => (
            <div
              key={i}
              className={cn('flex items-center border-b border-ld-border', i % 2 === 0 ? 'bg-ld-surface' : 'bg-ld-bg')}
            >
              <div className="w-[280px] flex items-center gap-2 px-3 py-1 shrink-0 border-r border-ld-border">
                <WfShim className="w-3 h-3 rounded-[3px] shrink-0" delay={i * 60} />
                <WfShim className="h-2.5 rounded-[3px] flex-1" delay={i * 60} style={{ maxWidth: 90 + ((i * 37) % 70) }} />
                <WfShim className="w-[30px] h-[14px] rounded-[5px] shrink-0" delay={i * 60} />
                <WfShim className="w-11 h-2.5 rounded-[3px] shrink-0" delay={i * 60} />
              </div>

              <div className="flex-1 relative h-5 flex items-center">
                <div className="absolute inset-x-0 h-px bg-ld-border" />
                <WfShim
                  className="absolute h-2.5 rounded-sm"
                  delay={i * 60}
                  style={{ left: `${r.left}%`, width: `${r.width}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
