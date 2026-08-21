import { useCallback, useEffect, useRef, useState } from 'react';

export type PlaySpeed = 0.5 | 1;

/** One tick every 50ms — 20fps, enough for a filmstrip and cheap enough for four charts. */
const TICK_MS = 50;

/**
 * The play/pause/seek clock behind every timeline scrubber.
 *
 * Four components each hand-rolled this loop — three on setInterval, one on
 * requestAnimationFrame, so that one silently played at a different speed than the
 * others. The clock lives in refs, not state: a tick must not re-render the component
 * that owns it — `onTick` decides what a position change touches (a MotionValue, a
 * state setter, an imperative DOM update).
 *
 * Semantics shared by all callers: play resumes from the last position, restarts from 0
 * when the clock is at the end, and stops itself on reaching `totalMs`; `seek` pauses
 * and clamps into [0, totalMs].
 */
export function useTimelinePlayback({ totalMs, onTick }: {
  totalMs: number;
  /** Called with the new clock position on every tick and on seek. */
  onTick: (ms: number) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaySpeed>(1);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef    = useRef(0);
  const speedRef    = useRef(speed);
  const totalRef    = useRef(totalMs);
  const onTickRef   = useRef(onTick);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  totalRef.current  = totalMs;
  onTickRef.current = onTick;

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (clockRef.current >= totalRef.current) {
      clockRef.current = 0;
      onTickRef.current(0);
    }
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      clockRef.current = Math.min(clockRef.current + TICK_MS * speedRef.current, totalRef.current);
      onTickRef.current(clockRef.current);
      if (clockRef.current >= totalRef.current) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsPlaying(false);
      }
    }, TICK_MS);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const toggle = useCallback(
    () => { if (isPlaying) stop(); else start(); },
    [isPlaying, stop, start],
  );

  const seek = useCallback((ms: number) => {
    stop();
    clockRef.current = Math.max(0, Math.min(ms, totalRef.current));
    onTickRef.current(clockRef.current);
  }, [stop]);

  return { isPlaying, speed, setSpeed, toggle, seek };
}
