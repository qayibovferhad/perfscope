import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useMotionValue, type MotionValue } from 'framer-motion';

interface TimelineContextValue {
  motionMs:      MotionValue<number>;
  maxTiming:     React.MutableRefObject<number>;
  networkOffset: React.MutableRefObject<number>;
}

const TimelineCtx = createContext<TimelineContextValue | null>(null);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const motionMs      = useMotionValue(0);
  const maxTiming     = useRef(0);
  const networkOffset = useRef(0);
  return (
    <TimelineCtx.Provider value={{ motionMs, maxTiming, networkOffset }}>
      {children}
    </TimelineCtx.Provider>
  );
}

export function useTimelineContext(): TimelineContextValue | null {
  return useContext(TimelineCtx);
}
