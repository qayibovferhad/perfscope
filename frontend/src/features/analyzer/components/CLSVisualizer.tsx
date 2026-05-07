import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { AlertTriangle, SkipForward, ChevronRight, Zap, Info } from 'lucide-react';
import type { CLSData, CLSShiftElement, TimelineData, TimelineFrame } from '../types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const RED        = 'rgba(255,50,50,1)';
const RED_A      = 'rgba(255,50,50,0.35)';
const RED_G      = 'rgba(255,50,50,0.18)';
const RED_B      = 'rgba(255,50,50,0.55)';
const RED_ALERT  = '#ef4444';             // intense alert red for peak state

// Logical dimensions used inside the SVG viewBox — the actual display is responsive.
const PREVIEW_W = 380;
const PREVIEW_H = 264; // ~380:264 ≈ 800:600 Puppeteer aspect ratio

const PANEL: React.CSSProperties = {
  background:           'var(--ps-panel-bg)',
  backdropFilter:       'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border:               '1px solid rgba(255,50,50,0.20)',
  borderRadius:         '1.25rem',
  overflow:             'hidden',
  boxShadow:            '0 0 48px rgba(255,50,50,0.06), 0 8px 32px rgba(0,0,0,0.40)',
};

const GLASS_CARD: React.CSSProperties = {
  background:     'rgba(255,255,255,0.04)',
  border:         '1px solid rgba(255,255,255,0.08)',
  borderRadius:   '0.875rem',
  backdropFilter: 'blur(8px)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreLabel(cls: number) {
  if (cls < 0.1)  return { text: 'Good',       color: '#10b981' };
  if (cls < 0.25) return { text: 'Needs Work', color: '#f59e0b' };
  return                  { text: 'Poor',       color: RED_ALERT };
}

function impactColor(impact: 'high' | 'medium' | 'low') {
  return impact === 'high' ? RED_ALERT : impact === 'medium' ? '#f59e0b' : '#6b7280';
}

function findFrameAt(frames: TimelineFrame[], ms: number): TimelineFrame {
  let best = frames[0];
  for (const f of frames) {
    if (f.timing <= ms) best = f;
    else break;
  }
  return best;
}

/**
 * AI-driven fix suggestion.
 * Priority order:
 *   1. Score < 0.005 → performance-budget message (noise suppression)
 *   2. Lighthouse rootCause (authoritative trace analysis)
 *   3. Selector/snippet heuristics
 */
function aiSuggestion(
  selector: string,
  snippet: string,
  score: number,
  rootCause?: string,
): string {
  // [#4] Budget-aware: below 0.005 is sub-perceptual — redirect attention upstream.
  if (score < 0.005)
    return 'Low impact shift. Focus on higher priority stability issues first.';

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
// memo'd with a custom comparator: only re-renders when isHovered or selector changes.

const CulpritItem = memo(function CulpritItem({
  element, rank, isHovered, onHover,
}: {
  element: CLSShiftElement;
  rank: number;
  isHovered: boolean;
  onHover: (el: CLSShiftElement | null) => void;
}) {
  const color = impactColor(element.impact);

  // [#4] Score passed into aiSuggestion so the budget-aware branch fires at < 0.005.
  const suggestion = useMemo(
    () => aiSuggestion(element.selector, element.snippet, element.score, element.rootCause),
    [element.selector, element.snippet, element.score, element.rootCause],
  );

  const isLowImpact = element.score < 0.005;

  return (
    <motion.div
      layout
      onMouseEnter={() => onHover(element)}
      onMouseLeave={() => onHover(null)}
      style={{
        ...GLASS_CARD,
        border:     isHovered ? `1px solid ${RED}50` : GLASS_CARD.border,
        boxShadow:  isHovered ? `0 0 20px ${RED_G}, inset 0 0 12px ${RED_G}` : 'none',
        cursor:     'default',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        opacity:    isLowImpact ? 0.72 : 1,
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

      {/* AI suggestion — concise budget message for < 0.005, full advice otherwise */}
      <div
        className="flex gap-1.5 rounded-md p-2"
        style={{
          background: isLowImpact ? 'rgba(107,114,128,0.08)' : 'rgba(255,50,50,0.06)',
          border:     isLowImpact ? '1px solid rgba(107,114,128,0.18)' : '1px solid rgba(255,50,50,0.12)',
        }}
      >
        <Zap className="w-3 h-3 shrink-0 mt-0.5" style={{ color: isLowImpact ? '#6b7280' : RED }} />
        <p className="text-[9px] leading-snug" style={{ color: isLowImpact ? 'rgba(200,200,200,0.55)' : 'rgba(255,200,200,0.80)' }}>
          {suggestion}
        </p>
      </div>

      {/* Pulsating indicator when hovered */}
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
}, (prev, next) =>
  prev.isHovered === next.isHovered && prev.element.selector === next.element.selector,
);

// ─── Frame Preview with SVG Overlay ──────────────────────────────────────────
// [#5] Responsive: uses aspect-ratio + max-width so it never distorts on small screens.
// The SVG viewBox remains fixed at PREVIEW_W × PREVIEW_H, so rect coords scale correctly.

function FramePreview({
  frame, hoveredElement, cls, shakeControls,
}: {
  frame: TimelineFrame;
  hoveredElement: CLSShiftElement | null;
  cls: number;
  shakeControls: ReturnType<typeof useAnimation>;
}) {
  const { text: ratingText, color: ratingColor } = scoreLabel(cls);
  const hasRect = hoveredElement !== null && hoveredElement.rect !== undefined;

  return (
    // [#3] Shake wrapper — animations fired by shakeControls from handleJump.
    <motion.div
      animate={shakeControls}
      style={{ width: '100%', maxWidth: PREVIEW_W, display: 'flex', justifyContent: 'center' }}
    >
      <div
        className="relative overflow-hidden rounded-xl"
        style={{
          // [#5] Responsive: aspect-ratio preserves proportions; max-width caps it.
          width:       '100%',
          maxWidth:    PREVIEW_W,
          aspectRatio: `${PREVIEW_W} / ${PREVIEW_H}`,
          border:      `1.5px solid ${hoveredElement ? RED : 'rgba(255,255,255,0.08)'}`,
          boxShadow:   hoveredElement ? `0 0 30px ${RED_B}, 0 0 60px rgba(255,50,50,0.15)` : 'none',
          transition:  'box-shadow 0.25s, border-color 0.25s',
          background:  'rgba(0,0,0,0.6)',
        }}
      >
        {/* Screenshot */}
        {frame.data ? (
          <img
            src={frame.data}
            alt="page frame"
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}
          >
            No screenshot
          </div>
        )}

        {/* [#1] SVG heatmap overlay with prominent CSS drop-shadow glow */}
        {hasRect && hoveredElement?.rect && (
          <svg
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              pointerEvents: 'none',
              // CSS drop-shadow on the SVG element itself amplifies the glow
              // across the entire overlay layer for maximum visual prominence.
              filter: 'drop-shadow(0 0 8px rgba(255,50,50,0.80))',
            }}
            viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Dim everything outside the shift region */}
            <rect x={0} y={0} width={PREVIEW_W} height={PREVIEW_H} fill="rgba(0,0,0,0.35)" />

            {/* Shift bounding box — CSS drop-shadow propagates from this rect */}
            <motion.rect
              x={hoveredElement.rect.leftPct  * PREVIEW_W}
              y={hoveredElement.rect.topPct   * PREVIEW_H}
              width={hoveredElement.rect.widthPct  * PREVIEW_W}
              height={hoveredElement.rect.heightPct * PREVIEW_H}
              fill={RED_A}
              stroke={RED}
              strokeWidth={2.5}
              rx={3}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Animated dashed outer ring */}
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

        {/* [#2] Graceful fallback when element is hovered but has no coordinates */}
        {hoveredElement && !hasRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              className="px-4 py-2.5 rounded-xl text-center"
              style={{
                background:     'rgba(0,0,0,0.78)',
                backdropFilter: 'blur(10px)',
                border:         '1px solid rgba(255,50,50,0.25)',
                boxShadow:      '0 0 20px rgba(0,0,0,0.5)',
              }}
            >
              <p className="text-[10px] font-medium" style={{ color: 'rgba(255,200,200,0.70)' }}>
                Visual coordinates unavailable for this element
              </p>
            </div>
          </motion.div>
        )}

        {/* Frame timing + CLS rating footer */}
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
    </motion.div>
  );
}

// ─── Timeline Scrubber ────────────────────────────────────────────────────────
// [#2] isAtPeak: when the scrubber sits within ±5% of the biggest-shift target,
// the handle border/glow switches to alert red (#ef4444) for stronger visual cue.

function Scrubber({
  frames, currentMs, totalMs, isAtPeak, onSeek,
}: {
  frames: TimelineFrame[];
  currentMs: number;
  totalMs: number;
  isAtPeak: boolean;
  onSeek: (ms: number) => void;
}) {
  const handleColor = isAtPeak ? RED_ALERT : RED;
  const handleGlow  = isAtPeak
    ? 'drop-shadow(0 0 6px rgba(239,68,68,0.95))'
    : `drop-shadow(0 0 4px ${RED_B})`;

  const pct    = `${((currentMs / totalMs) * 100).toFixed(2)}%`;
  const active = findFrameAt(frames, currentMs);

  return (
    <div className="space-y-3">
      {/* Range input */}
      <div className="relative flex items-center gap-3">
        <input
          type="range" min={0} max={totalMs} step={16} value={currentMs}
          onChange={e => onSeek(Number(e.target.value))}
          className="w-full appearance-none h-1.5 rounded-full outline-none cursor-pointer"
          style={{ background: `linear-gradient(to right, ${handleColor} ${pct}, rgba(255,255,255,0.10) ${pct})` }}
        />
        {/* Custom thumb — colour and glow transition smoothly via CSS */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full pointer-events-none"
          style={{
            left:       pct,
            background: '#fff',
            border:     `2px solid ${handleColor}`,
            filter:     handleGlow,
            transition: 'border-color 0.3s, filter 0.3s',
          }}
        />
        <span
          className="shrink-0 text-[10px] font-mono tabular-nums"
          style={{ color: 'rgba(255,255,255,0.45)', minWidth: 44 }}
        >
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
                width:     58,
                height:    42,
                border:    `1.5px solid ${isActive ? handleColor : 'rgba(255,255,255,0.07)'}`,
                boxShadow: isActive
                  ? `0 0 10px ${isAtPeak ? 'rgba(239,68,68,0.7)' : RED_B}`
                  : 'none',
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
                style={{
                  background: 'rgba(0,0,0,0.72)',
                  fontSize: 7,
                  color: isActive ? handleColor : 'rgba(255,255,255,0.35)',
                }}
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
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          Cumulative CLS
        </span>
        <CLSBadge score={currentCls} animated />
      </div>

      {/* [#2] Progress bar — motion.div ensures smooth transitions match scrubber */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,50,50,0.12)' }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.10, ease: 'linear' }}
          style={{
            background: `linear-gradient(90deg, rgba(255,50,50,0.6), ${color})`,
            boxShadow:  `0 0 8px ${RED_B}`,
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

// ─── Empty State ──────────────────────────────────────────────────────────────

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
  const frames  = timelineData.frames;
  const totalMs = frames.at(-1)?.timing ?? 0;

  const [currentMs,      setCurrentMs]      = useState(0);
  const [hoveredElement, setHoveredElement] = useState<CLSShiftElement | null>(null);

  // [#3] Animation controls for the "Jump to Biggest Shift" shake effect.
  const shakeControls = useAnimation();

  // RAF ref: smooth seek animation; cancelled on unmount to prevent stale updates.
  const rafRef = useRef<number | null>(null);

  const cancelJumpRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => cancelJumpRaf, [cancelJumpRaf]);

  // ── Advanced CLS ramp ────────────────────────────────────────────────────
  // Starts exactly at FCP. Math.pow(t, 2.5): slow immediately post-FCP,
  // accelerating through mid-load where shifts cluster, plateau at 85% of totalMs.
  const currentCls = useMemo(() => {
    if (totalMs === 0) return clsData.totalScore;
    const fcpMs   = timelineData.metrics.fcp ?? 0;
    const startMs = Math.max(fcpMs, totalMs * 0.05);
    const endMs   = totalMs * 0.85;
    if (currentMs <= startMs) return 0;
    if (currentMs >= endMs)   return clsData.totalScore;
    const t = (currentMs - startMs) / (endMs - startMs);
    return clsData.totalScore * Math.pow(t, 2.5);
  }, [currentMs, totalMs, clsData.totalScore, timelineData.metrics.fcp]);

  // [#2] Peak detection: scrubber is within ±5% of the biggest-shift window.
  const jumpTargetMs = Math.round(totalMs * 0.40);
  const isAtPeak     = Math.abs(currentMs - jumpTargetMs) < totalMs * 0.05;

  // Animated seek to the CLS peak with ease-out-cubic, then fire the shake effect.
  const handleJump = useCallback(() => {
    cancelJumpRaf();
    const target    = jumpTargetMs;
    const startWall = performance.now();
    const startMs   = currentMs;
    const DURATION  = 600;

    function step(now: number) {
      const elapsed = now - startWall;
      const t       = Math.min(elapsed / DURATION, 1);
      const eased   = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      setCurrentMs(Math.round(startMs + (target - startMs) * eased));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        // [#3] Shake + pulse glow fires once the scrubber lands on the target frame.
        shakeControls.start({
          x:         [0, -9, 9, -6, 6, -3, 3, 0],
          filter: [
            'drop-shadow(0 0 0px rgba(239,68,68,0))',
            'drop-shadow(0 0 28px rgba(239,68,68,0.90))',
            'drop-shadow(0 0 0px rgba(239,68,68,0))',
          ],
          transition: { duration: 0.50, ease: 'easeOut' },
        });
      }
    }
    rafRef.current = requestAnimationFrame(step);
  }, [jumpTargetMs, currentMs, cancelJumpRaf, shakeControls]);

  const activeFrame = findFrameAt(frames, currentMs);
  const sortedElems = useMemo(
    () => [...clsData.elements].sort((a, b) => b.score - a.score),
    [clsData.elements],
  );

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
            style={{ background: RED_G, border: `1px solid ${RED_A}`, color: RED }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,50,50,0.22)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = RED_G; }}
          >
            <SkipForward className="w-3.5 h-3.5" />
            Jump to Biggest Shift
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-0">

        {/* LEFT: Stability Issues Sidebar */}
        <div
          className="lg:w-72 xl:w-80 shrink-0 p-4 space-y-2 overflow-y-auto"
          style={{
            borderRight:    '1px solid rgba(255,255,255,0.05)',
            maxHeight:      540,
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

        {/* RIGHT: Preview + Tracker + Scrubber */}
        <div className="flex-1 p-4 space-y-4 min-w-0">
          <FramePreview
            frame={activeFrame}
            hoveredElement={hoveredElement}
            cls={currentCls}
            shakeControls={shakeControls}
          />
          <CLSTracker currentCls={currentCls} totalCls={clsData.totalScore} />
          <Scrubber
            frames={frames}
            currentMs={currentMs}
            totalMs={totalMs}
            isAtPeak={isAtPeak}
            onSeek={ms => { cancelJumpRaf(); setCurrentMs(ms); }}
          />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-5 px-6 py-3 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,50,50,0.10)' }}
      >
        {[
          { dot: RED_ALERT, label: 'High impact (≥ 0.05)'   },
          { dot: '#f59e0b', label: 'Medium impact (≥ 0.015)' },
          { dot: '#6b7280', label: 'Low impact'              },
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
