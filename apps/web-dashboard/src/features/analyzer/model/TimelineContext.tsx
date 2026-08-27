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

interface TimelineProviderProps {
  children: ReactNode;
  sharedMotionMs?: MotionValue<number>;
}

export function TimelineProvider({ children, sharedMotionMs }: TimelineProviderProps) {
  const ownMotionMs   = useMotionValue(0);
  const motionMs      = sharedMotionMs ?? ownMotionMs;
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

// A context's hook belongs beside its provider; splitting them to please fast refresh
// hides who owns the value.
// eslint-disable-next-line react-refresh/only-export-components
export function useTimelineContext(): TimelineContextValue | null {
  return useContext(TimelineCtx);
}
