import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { SkipForward, Zap, Layers } from 'lucide-react';
import { Panel, PanelHeader } from '@/shared/ui/panel';
import { Button } from '@/shared/ui/button';
import { StatePanel } from '@/shared/ui/state-panel';
import { Scrubber } from '@/shared/ui/scrubber';
import { cn } from '@/shared/lib/utils';
import { vitalBand, findFrameAt } from '@/entities/analysis';
import type { CLSData, CLSShiftElement, TimelineData, TimelineFrame } from '@/entities/analysis';
import { fmtSec2, fmtCls } from '@/shared/lib/format';

// ─── Design tokens ────────────────────────────────────────────────────────────
// Steps of the rose scale, named for what this chart uses them as. A previous comment
// here claimed CSS vars "can't reach" SVG contexts — they do: an SVG presentation
// attribute is parsed as a CSS value, so var() resolves and follows the theme. Verified.

const ROSE     = 'var(--ld-rose)';
const ROSE_A   = 'var(--ld-rose-line)';
const ROSE_G   = 'var(--ld-rose-fill)';
const ROSE_B   = 'var(--ld-rose-strong)';

const PREVIEW_W = 380;
const PREVIEW_H = 264;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BAND_VAR = { good: 'var(--ld-accent-2)', warn: 'var(--ld-amber)', poor: 'var(--ld-rose)' } as const;
/** Thresholds come from the shared vitals table, never retyped here. */
const clsScoreColor = (score: number) => BAND_VAR[vitalBand('cls', score)];

/**
 * The fix for a shift, from its root cause and selector.
 *
 * This was called `aiSuggestion` and rendered under an "AI suggestion" heading, and it is
 * not AI — it is the rule table below, which is exactly why it is worth keeping: it is
 * instant, free, and right about the handful of causes that produce nearly every shift.
 * With real Gemini commentary now sitting a few sections up the same report, the label was
 * the only dishonest part, so the label is what went.
 */
function shiftFix(selector: string, snippet: string, score: number, rootCause?: string): string {
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

// ─── CLS score chip ───────────────────────────────────────────────────────────

function CLSChip({ score }: { score: number }) {
  if (score < 0.1)
    return <span className="font-mono text-[11px] font-semibold px-[9px] py-[4px] rounded-[7px] border text-[var(--ld-accent-2)] border-ld-accent-line bg-ld-accent-soft">GOOD</span>;
  if (score < 0.25)
    return <span className="font-mono text-[11px] font-semibold px-[9px] py-[4px] rounded-[7px] border text-ld-amber border-ld-amber-line bg-ld-amber-soft">NEEDS WORK</span>;
  return <span className="font-mono text-[11px] font-semibold px-[9px] py-[4px] rounded-[7px] border text-ld-rose border-ld-rose-line bg-ld-rose-soft">POOR</span>;
}

// ─── Culprit issue card ───────────────────────────────────────────────────────

const CulpritItem = memo(function CulpritItem({
  element, rank, isHovered, onHover,
}: {
  element: CLSShiftElement;
  rank: number;
  isHovered: boolean;
  onHover: (el: CLSShiftElement | null) => void;
}) {
  const isLow = element.score < 0.005;
  const suggestion = useMemo(
    () => shiftFix(element.selector, element.snippet, element.score, element.rootCause),
    [element.selector, element.snippet, element.score, element.rootCause],
  );

  return (
    <div
      onMouseEnter={() => onHover(element)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'p-[14px] rounded-[12px] border bg-ld-surface-2 transition-all duration-150',
        isHovered ? 'border-ld-rose-strong' : 'border-ld-border',
        isLow && 'opacity-70',
      )}
      style={{ boxShadow: isHovered ? `0 0 16px ${ROSE_G}, inset 0 0 8px ${ROSE_G}` : 'none' }}
    >
      {/* Title row */}
      <div className="flex items-center justify-between gap-[10px] mb-[8px]">
        <div className="flex items-center gap-[9px]">
          <span className="w-[22px] h-[22px] rounded-[6px] grid place-items-center bg-ld-surface border border-ld-border font-mono text-[11px] text-ld-text-3 shrink-0">
            {rank}
          </span>
          <span className="font-mono text-[13px] text-ld-text">Shift #{rank}</span>
        </div>
        <span className={cn('font-mono text-[15px] font-semibold tabular-nums', isLow ? 'text-ld-text-2' : 'text-ld-amber')}>
          {element.score.toFixed(4)}
        </span>
      </div>

      {/* Level tag + animated bar */}
      <div className="flex items-center gap-[8px] mb-[8px]">
        <span className="font-mono text-[10px] px-[7px] py-[2px] rounded-[5px] border border-ld-border text-ld-text-3 uppercase shrink-0">
          {element.impact}
        </span>
        <div className="flex-1 h-[4px] rounded-full overflow-hidden bg-ld-border">
          <motion.div
            className="h-full rounded-full [background:linear-gradient(90deg,var(--ld-rose-line),var(--ld-rose))]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(element.score / 0.1, 1) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Suggested fix */}
      <div className={cn(
        'flex gap-[6px] rounded-[8px] p-[8px]',
        isLow
          ? 'bg-[rgba(111,130,120,.08)] border border-[rgba(111,130,120,.18)]'
          : 'bg-ld-rose-wash border border-ld-rose-soft',
      )}>
        <Zap className={cn('w-[12px] h-[12px] shrink-0 mt-[1px]', isLow ? 'text-ld-text-3' : 'text-ld-rose')} />
        <p className={cn('text-[12px] leading-snug', isLow ? 'text-ld-text-3' : 'text-ld-text-2')}>
          {suggestion}
        </p>
      </div>

      {/* Pulsating indicator on hover */}
      {isHovered && (
        <motion.div
          className="flex items-center gap-[4px] mt-[8px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <motion.span
            className="w-[6px] h-[6px] rounded-full bg-ld-rose"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <span className="font-mono text-[8px] text-ld-rose">Highlighted on frame</span>
        </motion.div>
      )}
    </div>
  );
}, (prev, next) =>
  prev.isHovered === next.isHovered && prev.element.selector === next.element.selector,
);

// ─── Frame preview with SVG overlay ──────────────────────────────────────────

function FramePreview({
  frame, hoveredElement, cls, shakeControls,
}: {
  frame: TimelineFrame;
  hoveredElement: CLSShiftElement | null;
  cls: number;
  shakeControls: ReturnType<typeof useAnimation>;
}) {
  const hasRect = hoveredElement !== null && hoveredElement.rect !== undefined;

  return (
    <motion.div animate={shakeControls} className="w-full">
      <div
        className="relative overflow-hidden rounded-[10px] border bg-ld-surface aspect-[380/264] transition-[box-shadow,border-color] duration-[250ms]"
        style={{
          borderColor: hoveredElement ? ROSE : 'var(--ld-border)',
          boxShadow:   hoveredElement ? `0 0 24px ${ROSE_B}` : 'none',
        }}
      >
        {/* Screenshot or skeleton */}
        {frame.data ? (
          <img
            src={frame.data}
            alt="page frame"
            draggable={false}
            className="w-full h-full object-contain block"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col">
            {/* Faux browser bar */}
            <div className="h-[30px] bg-ld-surface-2 border-b border-ld-border flex items-center gap-[6px] px-[10px] shrink-0">
              <span className="block h-[9px] w-[60px] rounded-[3px] bg-ld-border-strong" />
              <span className="block h-[9px] w-[30px] rounded-[3px] bg-ld-border-strong ml-auto" />
              <span className="block h-[9px] w-[30px] rounded-[3px] bg-ld-border-strong" />
            </div>
            {/* Skeleton body */}
            <div className="flex-1 px-[12px] py-[10px] grid gap-[8px] content-start">
              <span className="block h-[9px] w-[50%] rounded-[3px] bg-ld-surface-hover" />
              <span className="block h-[9px] w-[80%] rounded-[3px] bg-ld-surface-hover" />
              <span className="block h-[54px] w-full rounded-[8px] bg-ld-surface-hover" />
              <span className="block h-[9px] w-[65%] rounded-[3px] bg-ld-surface-hover" />
              <span className="block h-[9px] w-[40%] rounded-[3px] bg-ld-surface-hover" />
            </div>
          </div>
        )}

        {/* SVG heatmap overlay */}
        {hasRect && hoveredElement?.rect && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none [filter:drop-shadow(0_0_8px_var(--ld-rose-strong))]"
            viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <rect x={0} y={0} width={PREVIEW_W} height={PREVIEW_H} fill="rgba(0,0,0,0.30)" />
            <motion.rect
              x={hoveredElement.rect.leftPct   * PREVIEW_W}
              y={hoveredElement.rect.topPct    * PREVIEW_H}
              width={hoveredElement.rect.widthPct  * PREVIEW_W}
              height={hoveredElement.rect.heightPct * PREVIEW_H}
              fill={ROSE_A} stroke={ROSE} strokeWidth={2.5} rx={3}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.rect
              x={hoveredElement.rect.leftPct   * PREVIEW_W - 4}
              y={hoveredElement.rect.topPct    * PREVIEW_H - 4}
              width={hoveredElement.rect.widthPct  * PREVIEW_W + 8}
              height={hoveredElement.rect.heightPct * PREVIEW_H + 8}
              fill="none" stroke={ROSE} strokeWidth={1} rx={6}
              strokeDasharray="6 4"
              animate={{ opacity: [0.8, 0.2, 0.8], strokeDashoffset: [0, -20] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            />
          </svg>
        )}

        {/* No-rect fallback */}
        {hoveredElement && !hasRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center p-[24px] pointer-events-none"
          >
            <div className="px-[16px] py-[10px] rounded-[12px] text-center bg-ld-surface border border-ld-rose-fill shadow-ld-shadow-card">
              <p className="text-[10px] font-medium text-ld-text-3">
                Visual coordinates unavailable for this element
              </p>
            </div>
          </motion.div>
        )}

        {/* Frame footer */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-[8px] py-[4px] bg-[rgba(0,0,0,.65)]">
          <span className="font-mono text-[9px] tabular-nums text-ld-text-3">
            {fmtSec2(frame.timing)}
          </span>
          <span className="font-mono text-[9px] font-bold" style={{ color: clsScoreColor(cls) }}>
            CLS {fmtCls(cls)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── CLS Tracker ─────────────────────────────────────────────────────────────

function CLSTracker({ currentCls, totalCls }: { currentCls: number; totalCls: number }) {
  const fillPct = totalCls > 0 ? Math.min((currentCls / totalCls) * 100, 100) : 0;

  return (
    <div className="rounded-[12px] border border-ld-rose-fill bg-ld-rose-wash px-[12px] py-[10px] space-y-[8px]">
      <div className="flex items-center justify-between flex-wrap gap-[8px]">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[.1em] text-ld-text-3">
          Cumulative CLS
        </span>
        <div className="flex items-baseline gap-[8px]">
          <span className="font-mono font-semibold text-[18px] tabular-nums" style={{ color: clsScoreColor(currentCls) }}>
            {fmtCls(currentCls)}
          </span>
          <CLSChip score={currentCls} />
        </div>
      </div>
      <div className="h-[6px] rounded-full overflow-hidden bg-ld-border">
        <motion.div
          className="h-full rounded-full [background:linear-gradient(90deg,var(--ld-rose-line),var(--ld-rose))] [box-shadow:0_0_8px_var(--ld-rose-strong)]"
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.10, ease: 'linear' }}
        />
      </div>
      <div className="flex justify-between font-mono text-[8px] text-ld-text-3 opacity-50">
        <span>0.000</span>
        <span>Total: {fmtCls(totalCls)}</span>
      </div>
    </div>
  );
}

// ─── Timeline scrubber ────────────────────────────────────────────────────────

function ShiftScrubber({
  frames, currentMs, totalMs, jumpTargetMs, onSeek,
}: {
  frames: TimelineFrame[];
  currentMs: number;
  totalMs: number;
  jumpTargetMs: number;
  onSeek: (ms: number) => void;
}) {
  const active = findFrameAt(frames, currentMs);

  return (
    <div className="space-y-[10px]">
      {/* Range */}
      <div className="flex items-center gap-[12px]">
        <Scrubber value={currentMs} max={totalMs} onChange={onSeek} color="var(--ld-rose)" />
        <span className="shrink-0 font-mono text-[10px] text-ld-text-3 tabular-nums min-w-[44px]">
          {fmtSec2(currentMs)}
        </span>
      </div>

      {/* Filmstrip */}
      <div className="flex gap-[6px] overflow-x-auto" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
        {frames.map((frame, i) => {
          const isActive    = frame === active;
          const isShiftFrame = Math.abs(frame.timing - jumpTargetMs) < totalMs * 0.05;
          return (
            <button
              key={i}
              onClick={() => onSeek(frame.timing)}
              className={cn(
                'relative rounded-[6px] border shrink-0 overflow-hidden bg-ld-surface transition-all duration-100 w-[58px] h-[42px]',
                isActive     ? 'border-ld-accent-line [box-shadow:0_0_0_1px_var(--ld-accent-soft)]' :
                isShiftFrame ? 'border-ld-rose-strong' :
                               'border-ld-border',
              )}
            >
              {frame.data && (
                <img
                  src={frame.data}
                  alt={fmtSec2(frame.timing)}
                  draggable={false}
                  className="w-[56px] h-[40px] object-cover"
                  style={{ opacity: isActive ? 1 : 0.45 }}
                />
              )}
              <div
                className="absolute bottom-0 inset-x-0 text-center font-mono text-[7px] bg-[rgba(0,0,0,.72)] py-[1px]"
                style={{ color: isActive ? ROSE : 'rgba(255,255,255,.35)' }}
              >
                {(frame.timing / 1000).toFixed(1)}s
              </div>
            </button>
          );
        })}
      </div>

      {/* Axis */}
      <div className="flex justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="font-mono text-[8px] tabular-nums text-ld-text-3 opacity-50">
            {((i / 4) * totalMs / 1000).toFixed(1)}s
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CLSVisualizer({
  clsData, timelineData,
}: {
  clsData: CLSData;
  timelineData: TimelineData;
}) {
  const frames  = timelineData.frames;
  const totalMs = frames.at(-1)?.timing ?? 0;

  const [currentMs,      setCurrentMs]     = useState(0);
  const [hoveredElement, setHoveredElement] = useState<CLSShiftElement | null>(null);

  const shakeControls = useAnimation();
  const rafRef = useRef<number | null>(null);

  const cancelJumpRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => cancelJumpRaf, [cancelJumpRaf]);

  // CLS ramp: starts at FCP, accelerates through mid-load, plateaus at 85 % of totalMs.
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

  const jumpTargetMs = Math.round(totalMs * 0.40);

  const handleJump = useCallback(() => {
    cancelJumpRaf();
    const target    = jumpTargetMs;
    const startWall = performance.now();
    const startMs   = currentMs;
    const DURATION  = 600;

    function step(now: number) {
      const elapsed = now - startWall;
      const t       = Math.min(elapsed / DURATION, 1);
      const eased   = 1 - Math.pow(1 - t, 3);
      setCurrentMs(Math.round(startMs + (target - startMs) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        shakeControls.start({
          x: [0, -9, 9, -6, 6, -3, 3, 0],
          filter: [
            `drop-shadow(0 0 0px transparent)`,
            `drop-shadow(0 0 28px ${ROSE_B})`,
            `drop-shadow(0 0 0px transparent)`,
          ],
          transition: { duration: 0.50, ease: 'easeOut' },
        });
      }
    }
    rafRef.current = requestAnimationFrame(step);
  }, [jumpTargetMs, currentMs, cancelJumpRaf, shakeControls]);

  const activeFrame  = findFrameAt(frames, currentMs);
  const sortedElems  = useMemo(
    () => [...clsData.elements].sort((a, b) => b.score - a.score),
    [clsData.elements],
  );

  // ── Empty state ────────────────────────────────────────────────────────────

  if (clsData.elements.length === 0) {
    return (
      <Panel>
        <PanelHeader icon={<Layers />} title="Layout Shift Visualizer" meta="CLS" />
        <StatePanel
          className="border-0 bg-transparent"
          icon={<Layers className="w-6 h-6" />}
          title="No layout shifts detected"
          description="Lighthouse found no elements contributing to CLS. Your layout is stable."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader icon={<Layers />} title="Layout Shift Visualizer" meta="CLS">
        <Button variant="secondary" size="sm" onClick={handleJump}>
          <SkipForward />
          Jump to biggest shift
        </Button>
      </PanelHeader>

      {/* ── CLS score row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-[14px] px-[18px] py-[16px] border-b border-ld-border flex-wrap">
        <span className="inline-flex items-baseline gap-[9px]">
          <span
            className="font-mono font-semibold text-[30px] leading-none tabular-nums"
            style={{ color: clsScoreColor(clsData.totalScore) }}
          >
            {fmtCls(clsData.totalScore)}
          </span>
          <CLSChip score={clsData.totalScore} />
        </span>
        <span className="font-mono text-[12px] text-ld-text-3 ml-auto">
          {sortedElems.length} stability issue{sortedElems.length !== 1 ? 's' : ''} identified
        </span>
      </div>

      {/* ── Two-column grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_1.1fr] max-[760px]:grid-cols-1 gap-[18px] p-[18px]">

        {/* Left: issues list */}
        <div className="space-y-[10px]">
          <AnimatePresence initial={false}>
            {sortedElems.map((el, i) => (
              <motion.div
                // Not the selector alone: one element can shift more than once during a
                // load, so the same selector appears twice with different scores — and
                // React would drop the second, hiding a real shift from the list.
                key={`${el.selector}#${i}`}
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

        {/* Right: device preview + tracker + scrubber */}
        <div className="rounded-[14px] border border-ld-border bg-ld-bg-2 p-[14px] space-y-[12px]">
          <FramePreview
            frame={activeFrame}
            hoveredElement={hoveredElement}
            cls={currentCls}
            shakeControls={shakeControls}
          />
          <CLSTracker currentCls={currentCls} totalCls={clsData.totalScore} />
          <ShiftScrubber
            frames={frames}
            currentMs={currentMs}
            totalMs={totalMs}
            jumpTargetMs={jumpTargetMs}
            onSeek={ms => { cancelJumpRaf(); setCurrentMs(ms); }}
          />
        </div>
      </div>

      {/* ── Footer legend ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-[16px] px-[18px] py-[12px] border-t border-ld-border flex-wrap">
        {[
          { cls: 'bg-ld-rose',   label: 'High impact (≥ 0.05)'    },
          { cls: 'bg-ld-amber',  label: 'Medium impact (≥ 0.015)' },
          { cls: 'bg-ld-text-3', label: 'Low impact'              },
        ].map(({ cls: dotCls, label }) => (
          <span key={label} className="flex items-center gap-[6px] font-mono text-[9px] text-ld-text-3">
            <span className={cn('w-[8px] h-[8px] rounded-full shrink-0', dotCls)} />
            {label}
          </span>
        ))}
        <span className="font-mono text-[9px] text-ld-text-3 opacity-50">
          · Hover an element to highlight · Scrub to trace CLS buildup
        </span>
      </div>
    </Panel>
  );
}
