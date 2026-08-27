import { motion, type useAnimation } from 'framer-motion';
import { vitalBand } from '@/entities/analysis';
import type { CLSShiftElement, TimelineFrame } from '@/entities/analysis';
import { fmtSec2, fmtCls } from '@/shared/lib/format';

/**
 * One filmstrip frame with the shifting element drawn over it.
 *
 * Its own file because it owns a coordinate system nothing else does: the rects come from
 * Lighthouse as fractions of the viewport and are painted into a fixed 380×264 viewBox,
 * and the panel around it is about scrubbing and ranking culprits, not geometry.
 *
 * Steps of the rose scale, named for what this chart uses them as. A previous comment
 * claimed CSS vars "can't reach" SVG contexts — they do: an SVG presentation attribute is
 * parsed as a CSS value, so var() resolves and follows the theme. Verified.
 */
const ROSE   = 'var(--ld-rose)';
const ROSE_A = 'var(--ld-rose-line)';
const ROSE_B = 'var(--ld-rose-strong)';

/** The viewBox the overlay is drawn in; the element rects are fractions of it. */
const PREVIEW_W = 380;
const PREVIEW_H = 264;

const BAND_VAR = { good: 'var(--ld-accent-2)', warn: 'var(--ld-amber)', poor: 'var(--ld-rose)' } as const;
/** Thresholds come from the shared vitals table, never retyped here. */
const clsScoreColor = (score: number) => BAND_VAR[vitalBand('cls', score)];

export function FramePreview({
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
