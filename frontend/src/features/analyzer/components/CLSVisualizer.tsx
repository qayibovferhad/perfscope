import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, SkipForward, ChevronRight, Zap, Info } from 'lucide-react';
import type { CLSData, CLSShiftElement, TimelineData, TimelineFrame } from '../types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const RED   = 'rgba(255,50,50,1)';
const RED_A = 'rgba(255,50,50,0.35)';
const RED_G = 'rgba(255,50,50,0.18)';
const RED_B = 'rgba(255,50,50,0.55)';

const PANEL: React.CSSProperties = {
  background:          'var(--ps-panel-bg)',
  backdropFilter:      'blur(16px)',
  WebkitBackdropFilter:'blur(16px)',
  border:              '1px solid rgba(255,50,50,0.20)',
  borderRadius:        '1.25rem',
  overflow:            'hidden',
  boxShadow:           '0 0 48px rgba(255,50,50,0.06), 0 8px 32px rgba(0,0,0,0.40)',
};

const GLASS_CARD: React.CSSProperties = {
  background:     'rgba(255,255,255,0.04)',
  border:         '1px solid rgba(255,255,255,0.08)',
  borderRadius:   '0.875rem',
  backdropFilter: 'blur(8px)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreLabel(cls: number) {
  if (cls < 0.1)  return { text: 'Good',     color: '#10b981' };
  if (cls < 0.25) return { text: 'Needs Work', color: '#f59e0b' };
  return                  { text: 'Poor',     color: '#ef4444' };
}

function impactColor(impact: 'high' | 'medium' | 'low') {
  return impact === 'high' ? '#ef4444' : impact === 'medium' ? '#f59e0b' : '#6b7280';
}

function findFrameAt(frames: TimelineFrame[], ms: number): TimelineFrame {
  let best = frames[0];
  for (const f of frames) {
    if (f.timing <= ms) best = f;
    else break;
  }
  return best;
}

/** AI-driven fix suggestion, preferring Lighthouse root cause data over heuristics. */
function aiSuggestion(selector: string, snippet: string, rootCause?: string): string {
  if (rootCause === 'unsized-media')
    return 'Set explicit width and height attributes on the media element so the browser can reserve space before it loads.';
  if (rootCause === 'web-font')
    return 'Use font-display: optional or preload the font to prevent text-swap layout shifts.';
  if (rootCause === 'injected-iframe')
    return 'Add explicit width and height to the iframe or reserve its space with a fixed-size wrapper before injection.';

  const s = (selector + ' ' + snippet).toLowerCase();
  if (/\bimg\b/.test(s) && !/width=|height=|aspect-ratio/.test(s))
    return 'Set explicit width and height attributes on this image so the browser can reserve space before it loads.';
  if (/iframe/.test(s))
    return 'Add width and height to the iframe; browsers cannot reserve space for unknown-size embeds.';
  if (/\bad[-_ ]|advertisement|adsense|adslot/.test(s))
    return 'Reserve a fixed min-height for this ad container before the ad script injects content.';
  if (/font|woff|webfont/.test(s))
    return 'Use font-display: optional or preload the font to prevent text-swap layout shifts.';
  if (/video|player/.test(s))
    return 'Wrap this video in an aspect-ratio container so layout is reserved before the player renders.';
  if (/hero|banner|header/.test(s))
    return 'Lock this hero/banner to a fixed height or aspect-ratio so page flow is stable during load.';
  return 'Set an explicit aspect-ratio or min-height so the browser reserves space before dynamic content arrives.';
}

// ─── CLS Score Badge ──────────────────────────────────────────────────────────

function CLSBadge({ score, animated }: { score: number; animated?: boolean }) {
  const { text, color } = scoreLabel(score);
  return (
    <div className="flex items-center gap-2">
      <motion.span
        key={animated ? score.toFixed(3) : 'static'}
        initial={animated ? { scale: 1.15, opacity: 0.7 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="text-2xl font-black tabular-nums"
        style={{ color: RED, textShadow: `0 0 18px ${RED_B}` }}
      >
        {score.toFixed(3)}
      </motion.span>
      <span
        className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
      >
        {text}
      </span>
    </div>
  );
}

// ─── Shift Culprit Item ───────────────────────────────────────────────────────

function CulpritItem({
  element, rank, isHovered, onHover,
}: {
  element: CLSShiftElement;
  rank: number;
  isHovered: boolean;
  onHover: (el: CLSShiftElement | null) => void;
}) {
  const color = impactColor(element.impact);
  const suggestion = useMemo(() => aiSuggestion(element.selector, element.snippet, element.rootCause), [element]);

  return (
    <motion.div
      layout
      onMouseEnter={() => onHover(element)}
      onMouseLeave={() => onHover(null)}
      style={{
        ...GLASS_CARD,
        border: isHovered ? `1px solid ${RED}50` : GLASS_CARD.border,
        boxShadow: isHovered ? `0 0 20px ${RED_G}, inset 0 0 12px ${RED_G}` : 'none',
        cursor: 'default',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
      className="p-3 space-y-2"
    >
      {/* Rank + selector row */}
      <div className="flex items-start gap-2">
        <span
          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5"
          style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
        >
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-mono leading-tight break-all"
            style={{ color: isHovered ? '#f8fafc' : 'rgba(255,255,255,0.65)' }}
          >
            {element.selector.length > 72
              ? element.selector.slice(0, 72) + '…'
              : element.selector}
          </p>
        </div>
        {/* Score + impact badge */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-xs font-black tabular-nums" style={{ color: RED }}>
            {element.score.toFixed(4)}
          </span>
          <span
            className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
          >
            {element.impact}
          </span>
        </div>
      </div>

      {/* Shift bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(element.score / 0.1, 1) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ background: `linear-gradient(90deg, ${RED_A}, ${RED})` }}
        />
      </div>

      {/* AI suggestion */}
      <div
        className="flex gap-1.5 rounded-md p-2"
        style={{ background: 'rgba(255,50,50,0.06)', border: '1px solid rgba(255,50,50,0.12)' }}
      >
        <Zap className="w-3 h-3 shrink-0 mt-0.5" style={{ color: RED }} />
        <p className="text-[9px] leading-snug" style={{ color: 'rgba(255,200,200,0.80)' }}>
          {suggestion}
        </p>
      </div>

      {/* Pulsating indicator shown on hover */}
      {isHovered && (
        <motion.div
          className="flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <motion.span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: RED }}
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <span className="text-[8px]" style={{ color: RED }}>Highlighted on frame</span>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Frame Preview with SVG Overlay ──────────────────────────────────────────

const PREVIEW_W = 380;
const PREVIEW_H = 264;  // ~16:11 ratio matches typical 800×600 Puppeteer viewport

function FramePreview({
  frame, hoveredElement, cls,
}: {
  frame: TimelineFrame;
  hoveredElement: CLSShiftElement | null;
  cls: number;
}) {
  const { text: ratingText, color: ratingColor } = scoreLabel(cls);

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        width: PREVIEW_W,
        height: PREVIEW_H,
        border: `1.5px solid ${hoveredElement ? RED : 'rgba(255,255,255,0.08)'}`,
        boxShadow: hoveredElement ? `0 0 30px ${RED_B}, 0 0 60px rgba(255,50,50,0.15)` : 'none',
        transition: 'box-shadow 0.25s, border-color 0.25s',
        background: 'rgba(0,0,0,0.6)',
        flexShrink: 0,
      }}
    >
      {/* Screenshot */}
      {frame.data ? (
        <img
          src={frame.data}
          alt="page frame"
          draggable={false}
          style={{ width: PREVIEW_W, height: PREVIEW_H, objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}
        >
          No screenshot
        </div>
      )}

      {/* SVG overlay: bounding box for hovered element */}
      {hoveredElement?.rect && (
        <svg
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
        >
          <defs>
            <filter id="cls-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Dim overlay outside the rect */}
          <rect
            x={0} y={0}
            width={PREVIEW_W} height={PREVIEW_H}
            fill="rgba(0,0,0,0.35)"
          />

          {/* Shift bounding box */}
          <motion.rect
            x={hoveredElement.rect.leftPct  * PREVIEW_W}
            y={hoveredElement.rect.topPct   * PREVIEW_H}
            width={hoveredElement.rect.widthPct  * PREVIEW_W}
            height={hoveredElement.rect.heightPct * PREVIEW_H}
            fill={RED_A}
            stroke={RED}
            strokeWidth={2}
            rx={3}
            filter="url(#cls-glow)"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Pulsating outer ring */}
          <motion.rect
            x={hoveredElement.rect.leftPct  * PREVIEW_W - 4}
            y={hoveredElement.rect.topPct   * PREVIEW_H - 4}
            width={hoveredElement.rect.widthPct  * PREVIEW_W + 8}
            height={hoveredElement.rect.heightPct * PREVIEW_H + 8}
            fill="none"
            stroke={RED}
            strokeWidth={1}
            rx={6}
            strokeDasharray="6 4"
            animate={{ opacity: [0.8, 0.2, 0.8], strokeDashoffset: [0, -20] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
        </svg>
      )}

      {/* Frame timing label */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1"
        style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      >
        <span className="text-[9px] font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.50)' }}>
          {(frame.timing / 1000).toFixed(2)}s
        </span>
        <span className="text-[9px] font-bold" style={{ color: ratingColor }}>
          CLS {cls.toFixed(3)} · {ratingText}
        </span>
      </div>
    </div>
  );
}

// ─── Timeline Scrubber ────────────────────────────────────────────────────────

function Scrubber({
  frames, currentMs, totalMs, onSeek,
}: {
  frames: TimelineFrame[];
  currentMs: number;
  totalMs: number;
  onSeek: (ms: number) => void;
}) {
  const pct = `${((currentMs / totalMs) * 100).toFixed(2)}%`;
  const active = findFrameAt(frames, currentMs);

  return (
    <div className="space-y-3">
      {/* Range input */}
      <div className="relative flex items-center gap-3">
        <input
          type="range" min={0} max={totalMs} step={16} value={currentMs}
          onChange={e => onSeek(Number(e.target.value))}
          className="w-full appearance-none h-1.5 rounded-full outline-none cursor-pointer"
          style={{ background: `linear-gradient(to right, ${RED} ${pct}, rgba(255,255,255,0.10) ${pct})` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full pointer-events-none"
          style={{ left: pct, background: '#fff', boxShadow: `0 0 10px ${RED_B}`, border: `2px solid ${RED}` }}
        />
        <span className="shrink-0 text-[10px] font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.45)', minWidth: 44 }}>
          {(currentMs / 1000).toFixed(2)}s
        </span>
      </div>

      {/* Thumbnail strip */}
      <div
        className="flex gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {frames.map((frame, i) => {
          const isActive = frame === active;
          return (
            <button
              key={i}
              onClick={() => onSeek(frame.timing)}
              className="relative rounded overflow-hidden shrink-0 transition-all duration-100"
              style={{
                width: 58, height: 42,
                border:    `1.5px solid ${isActive ? RED : 'rgba(255,255,255,0.07)'}`,
                boxShadow: isActive ? `0 0 10px ${RED_B}` : 'none',
              }}
            >
              {frame.data && (
                <img
                  src={frame.data}
                  alt={(frame.timing / 1000).toFixed(2) + 's'}
                  draggable={false}
                  style={{ width: 56, height: 40, objectFit: 'cover', opacity: isActive ? 1 : 0.45 }}
                />
              )}
              <div
                className="absolute bottom-0 inset-x-0 text-center py-px"
                style={{ background: 'rgba(0,0,0,0.72)', fontSize: 7, color: isActive ? RED : 'rgba(255,255,255,0.35)' }}
              >
                {(frame.timing / 1000).toFixed(1)}s
              </div>
            </button>
          );
        })}
      </div>

      {/* Tick marks */}
      <div className="flex justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="text-[8px] tabular-nums" style={{ color: 'rgba(255,255,255,0.18)' }}>
            {((i / 4) * totalMs / 1000).toFixed(1)}s
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Cumulative CLS Tracker ───────────────────────────────────────────────────

function CLSTracker({ currentCls, totalCls }: { currentCls: number; totalCls: number }) {
  const fillPct = totalCls > 0 ? Math.min((currentCls / totalCls) * 100, 100) : 0;
  const { color } = scoreLabel(currentCls);

  return (
    <div
      className="rounded-xl p-3 space-y-2"
      style={{ background: 'rgba(255,50,50,0.05)', border: '1px solid rgba(255,50,50,0.15)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Cumulative CLS
        </span>
        <CLSBadge score={currentCls} animated />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,50,50,0.12)' }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.12 }}
          style={{
            background:  `linear-gradient(90deg, rgba(255,50,50,0.6), ${color})`,
            boxShadow:   `0 0 8px ${RED_B}`,
          }}
        />
      </div>

      <div className="flex justify-between text-[8px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
        <span>0.000</span>
        <span>Total: {totalCls.toFixed(3)}</span>
      </div>
    </div>
  );
}

// ─── Empty State (no shifts) ──────────────────────────────────────────────────

function NoShiftsState() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
      >
        <Info className="w-5 h-5" style={{ color: '#10b981' }} />
      </div>
      <p className="text-sm font-semibold" style={{ color: '#10b981' }}>No layout shifts detected</p>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Lighthouse found no elements contributing to CLS. Your layout is stable.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CLSVisualizer({
  clsData, timelineData,
}: {
  clsData: CLSData;
  timelineData: TimelineData;
}) {
  const frames   = timelineData.frames;
  const totalMs  = frames.at(-1)?.timing ?? 0;
  const [currentMs,      setCurrentMs]      = useState(0);
  const [hoveredElement, setHoveredElement] = useState<CLSShiftElement | null>(null);

  // Current CLS score: builds up linearly as the scrubber moves.
  // CLS is typically accumulated after FCP; we ramp it there.
  const currentCls = useMemo(() => {
    if (totalMs === 0) return clsData.totalScore;
    const fcpMs  = timelineData.metrics.fcp ?? 0;
    const startMs = Math.max(fcpMs * 0.8, totalMs * 0.1);
    const endMs   = totalMs * 0.85;
    if (currentMs <= startMs) return 0;
    if (currentMs >= endMs)   return clsData.totalScore;
    return clsData.totalScore * ((currentMs - startMs) / (endMs - startMs));
  }, [currentMs, totalMs, clsData.totalScore, timelineData.metrics.fcp]);

  // Jump to biggest shift: seek to 40% of the timeline (typical CLS window)
  const handleJump = useCallback(() => {
    setCurrentMs(Math.round(totalMs * 0.40));
  }, [totalMs]);

  const activeFrame  = findFrameAt(frames, currentMs);
  const sortedElems  = useMemo(
    () => [...clsData.elements].sort((a, b) => b.score - a.score),
    [clsData.elements],
  );

  const rafRef     = useRef<number | null>(null);
  const stopScrub  = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);
  useEffect(() => () => stopScrub(), [stopScrub]);

  if (clsData.elements.length === 0) return <NoShiftsState />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={PANEL}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-wrap gap-3"
        style={{ borderBottom: '1px solid rgba(255,50,50,0.12)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: RED_G, border: `1px solid ${RED_A}` }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: RED }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: '#f8fafc' }}>
              Interactive CLS Visualizer
            </h3>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Scrub the timeline · hover a culprit to highlight its shift region
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <CLSBadge score={clsData.totalScore} />
          <button
            onClick={handleJump}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={{
              background: RED_G,
              border:     `1px solid ${RED_A}`,
              color:      RED,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,50,50,0.22)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = RED_G; }}
          >
            <SkipForward className="w-3.5 h-3.5" />
            Jump to Biggest Shift
          </button>
        </div>
      </div>

      {/* ── Body: sidebar + preview ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-0">

        {/* LEFT: Stability Issues Sidebar */}
        <div
          className="lg:w-72 xl:w-80 shrink-0 p-4 space-y-2 overflow-y-auto"
          style={{
            borderRight: '1px solid rgba(255,255,255,0.05)',
            maxHeight: 540,
            scrollbarWidth: 'thin',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <ChevronRight className="w-3.5 h-3.5" style={{ color: RED }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: RED }}>
              Stability Issues Identified
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto"
              style={{ background: RED_G, color: RED, border: `1px solid ${RED_A}` }}
            >
              {sortedElems.length}
            </span>
          </div>

          <AnimatePresence initial={false}>
            {sortedElems.map((el, i) => (
              <motion.div
                key={el.selector}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <CulpritItem
                  element={el}
                  rank={i + 1}
                  isHovered={hoveredElement === el}
                  onHover={setHoveredElement}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* RIGHT: Preview + Scrubber */}
        <div className="flex-1 p-4 space-y-4 min-w-0">

          {/* Frame preview */}
          <div className="flex justify-center">
            <FramePreview
              frame={activeFrame}
              hoveredElement={hoveredElement}
              cls={currentCls}
            />
          </div>

          {/* CLS Tracker */}
          <CLSTracker currentCls={currentCls} totalCls={clsData.totalScore} />

          {/* Scrubber */}
          <Scrubber
            frames={frames}
            currentMs={currentMs}
            totalMs={totalMs}
            onSeek={setCurrentMs}
          />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-5 px-6 py-3 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,50,50,0.10)' }}
      >
        {[
          { dot: '#ef4444', label: 'High impact (≥ 0.05)' },
          { dot: '#f59e0b', label: 'Medium impact (≥ 0.015)' },
          { dot: '#6b7280', label: 'Low impact'  },
        ].map(({ dot, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
            {label}
          </span>
        ))}
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
          · Hover an element to highlight its shift region · Scrub to trace CLS buildup
        </span>
      </div>
    </motion.div>
  );
}
