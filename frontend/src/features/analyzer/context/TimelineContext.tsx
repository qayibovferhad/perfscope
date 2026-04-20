import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useMotionValue, type MotionValue } from 'framer-motion';

interface TimelineContextValue {
  motionMs:      MotionValue<number>;
  /** URL of the waterfall row currently hovered; empty string when nothing is hovered */
  hoveredUrl:    MotionValue<string>;
  maxTiming:     React.MutableRefObject<number>;
  networkOffset: React.MutableRefObject<number>;
  /** Registered by FlameChart; call to programmatically zoom to a time range */
  zoomFnRef:     React.MutableRefObject<((startMs: number, endMs: number) => void) | null>;
}

const TimelineCtx = createContext<TimelineContextValue | null>(null);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const motionMs      = useMotionValue(0);
  const hoveredUrl    = useMotionValue('');
  const maxTiming     = useRef(0);
  const networkOffset = useRef(0);
  const zoomFnRef     = useRef<((startMs: number, endMs: number) => void) | null>(null);
  return (
    <TimelineCtx.Provider value={{ motionMs, hoveredUrl, maxTiming, networkOffset, zoomFnRef }}>
      {children}
    </TimelineCtx.Provider>
  );
}

export function useTimelineContext(): TimelineContextValue | null {
  return useContext(TimelineCtx);
}
