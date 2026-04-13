import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useMotionValue, type MotionValue } from 'framer-motion';

interface TimelineContextValue {
  motionMs:      MotionValue<number>;
  /** URL of the waterfall row currently hovered; empty string when nothing is hovered */
  hoveredUrl:    MotionValue<string>;
  maxTiming:     React.MutableRefObject<number>;
  networkOffset: React.MutableRefObject<number>;
}

const TimelineCtx = createContext<TimelineContextValue | null>(null);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const motionMs      = useMotionValue(0);
  const hoveredUrl    = useMotionValue('');
  const maxTiming     = useRef(0);
  const networkOffset = useRef(0);
  return (
    <TimelineCtx.Provider value={{ motionMs, hoveredUrl, maxTiming, networkOffset }}>
      {children}
    </TimelineCtx.Provider>
  );
}

export function useTimelineContext(): TimelineContextValue | null {
  return useContext(TimelineCtx);
}
