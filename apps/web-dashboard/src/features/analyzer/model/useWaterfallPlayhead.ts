import { useEffect, useLayoutEffect, useRef } from 'react';
import type { MotionValue } from 'framer-motion';
import { fmtMsOrDash } from '@/shared/lib/format';
import type { NetworkRequest } from '@/entities/analysis';

/**
 * The imperative half of a waterfall: ghost playhead lines, the live time label, and
 * each row's pending/loading/loaded state, all driven off a MotionValue with zero React
 * re-renders per tick. Both waterfall variants carried this ~70-line block verbatim
 * (subscriber + ResizeObserver + four parallel ref arrays); the copies had already
 * drifted in their null-guards.
 *
 * Wire-up: put `rootRef` on the panel root (its width, minus `leftW`, is the lane
 * width), `rowsLineRef`/`axisLineRef` on up to two playhead lines (the rows line is
 * offset by `leftW`, the axis line is inside the lane already), `labelRef` on the time
 * readout, and hand each row the four per-index ref arrays.
 */
export function useWaterfallPlayhead({ rows, axisMs, leftW, motionMs, networkOffset }: {
  rows: NetworkRequest[];
  axisMs: number;
  leftW: number;
  /** The clock to follow. Null → static waterfall, no subscription at all. */
  motionMs: MotionValue<number> | null;
  /** Offset from request time into filmstrip time, read at tick time. */
  networkOffset?: { readonly current: number } | undefined;
}) {
  const rootRef     = useRef<HTMLDivElement>(null);
  const rowsLineRef = useRef<HTMLDivElement>(null);
  const axisLineRef = useRef<HTMLDivElement>(null);
  const labelRef    = useRef<HTMLSpanElement>(null);
  const chartWRef   = useRef(0);

  // Read at tick time so a resize or a new audit does not need to resubscribe.
  const axisMsRef = useRef(axisMs);
  axisMsRef.current = axisMs;

  const rowRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const ttfbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dlRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const shimRefs = useRef<(HTMLDivElement | null)[]>([]);
  rowRefs.current.length  = rows.length;
  ttfbRefs.current.length = rows.length;
  dlRefs.current.length   = rows.length;
  shimRefs.current.length = rows.length;

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const update = () => { chartWRef.current = (rootRef.current?.clientWidth ?? 0) - leftW; };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, [leftW]);

  useEffect(() => {
    if (!motionMs) return;
    const unsub = motionMs.on('change', (sliderMs) => {
      const axMs   = axisMsRef.current;
      const netOff = networkOffset?.current ?? 0;
      const pct    = Math.min(Math.max(sliderMs / axMs, 0), 1);
      const chartW = chartWRef.current;

      if (rowsLineRef.current) {
        rowsLineRef.current.style.transform = `translateX(${(leftW + chartW * pct).toFixed(1)}px)`;
      }
      if (axisLineRef.current) {
        axisLineRef.current.style.transform = `translateX(${(chartW * pct).toFixed(1)}px)`;
      }
      if (labelRef.current) {
        labelRef.current.textContent = fmtMsOrDash(sliderMs);
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
  }, [motionMs, rows, leftW, networkOffset]);

  return { rootRef, rowsLineRef, axisLineRef, labelRef, rowRefs, ttfbRefs, dlRefs, shimRefs };
}
