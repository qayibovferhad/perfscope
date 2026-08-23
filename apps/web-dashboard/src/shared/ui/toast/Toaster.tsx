import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Check, Info, Loader2, X, XCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useToastStore, type Toast, type ToastType } from './toastStore';

/**
 * Tone per kind, from the same band tokens every other surface uses. No new colours: a
 * toast that invented its own green would be the one green in the product that means
 * something slightly different.
 */
const TONE: Record<ToastType, { icon: typeof Check; tile: string; bar: string }> = {
  success: { icon: Check,         tile: 'text-[var(--ld-accent)] border-[var(--ld-accent-line)] bg-[var(--ld-accent-soft)]', bar: 'bg-ld-accent' },
  error:   { icon: XCircle,       tile: 'text-ld-rose border-[var(--ld-rose-line)] bg-[var(--ld-rose-soft)]',                bar: 'bg-ld-rose' },
  warning: { icon: AlertTriangle, tile: 'text-ld-amber border-[var(--ld-amber-line)] bg-[var(--ld-amber-soft)]',             bar: 'bg-ld-amber' },
  info:    { icon: Info,          tile: 'text-ld-text-2 border-ld-border-strong bg-ld-surface-2',                            bar: 'bg-ld-text-3' },
  loading: { icon: Loader2,       tile: 'text-[var(--ld-accent)] border-[var(--ld-accent-line)] bg-[var(--ld-accent-soft)]', bar: 'bg-ld-accent' },
};

/** Past this much horizontal drag, letting go dismisses. */
const SWIPE_DISMISS_PX = 90;

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useToastStore(s => s.dismiss);
  const reduced = useReducedMotion();
  const tone = TONE[toast.type];
  const Icon = tone.icon;
  const timed = Number.isFinite(toast.duration);

  // A swipe ends in a click event too, and a card that navigated every time someone pushed
  // it aside would be worse than one that could not be clicked at all.
  const dragged = useRef(false);

  const open = () => {
    if (dragged.current || !toast.onClick) return;
    toast.onClick();
    dismiss(toast.id);
  };

  return (
    <motion.div
      layout={!reduced}
      // `version` in the key restarts the progress animation when a toast is updated in
      // place — otherwise a loading card promoted to success would inherit the elapsed
      // time of the wait and vanish immediately.
      key={`${toast.id}-${toast.version}`}
      // Down from the top edge, which is where the stack now lives; a card that slid in
      // from the right would be arriving from a direction nothing else on screen uses.
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
      drag={reduced ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.02, right: 0.7 }}
      onDragStart={() => { dragged.current = false; }}
      onDrag={(_, info) => { if (Math.abs(info.offset.x) > 4) dragged.current = true; }}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_DISMISS_PX) dismiss(toast.id);
        // Cleared on the next tick so the click this drag produces is still suppressed.
        setTimeout(() => { dragged.current = false; }, 0);
      }}
      onClick={open}
      // `group` drives the pause-on-hover below; `pointer-events-auto` because the
      // container itself is transparent to clicks.
      className={cn(
        'ps-toast group pointer-events-auto relative w-[min(380px,calc(100vw-32px))] overflow-hidden',
        'rounded-[14px] border border-ld-border-strong bg-ld-surface shadow-ld-shadow-card',
        toast.onClick
          ? 'cursor-pointer hover:border-ld-accent-line transition-colors'
          : 'cursor-grab active:cursor-grabbing',
      )}
      role={toast.type === 'error' ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-[11px] p-[14px] pr-[38px]">
        <span className={cn('w-[26px] h-[26px] shrink-0 rounded-[8px] grid place-items-center border', tone.tile)}>
          <Icon className={cn('w-[15px] h-[15px]', toast.type === 'loading' && 'animate-spin')} />
        </span>

        <div className="min-w-0 flex-1 pt-[2px]">
          <p className="text-[14px] font-semibold leading-snug text-ld-text m-0 break-words">{toast.title}</p>
          {toast.description && (
            <p className="text-[12.5px] leading-[1.5] text-ld-text-2 mt-[3px] m-0 break-words">{toast.description}</p>
          )}
          {toast.action && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toast.action!.onClick(); dismiss(toast.id); }}
              className="mt-[9px] font-mono text-[11.5px] font-semibold uppercase tracking-[.08em] text-ld-accent
                         bg-transparent border-0 p-0 cursor-pointer hover:underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); dismiss(toast.id); }}
        aria-label="Dismiss notification"
        className="absolute top-[9px] right-[9px] w-[22px] h-[22px] grid place-items-center rounded-[6px]
                   text-ld-text-3 hover:text-ld-text hover:bg-ld-surface-2 transition-colors bg-transparent border-0 cursor-pointer"
      >
        <X className="w-[13px] h-[13px]" />
      </button>

      {/* The bar is not a decoration of the timer — it *is* the timer. Its animation ending
          is what dismisses the toast, so hovering pauses the countdown and the bar together
          instead of pausing one and letting the other run out underneath it. */}
      {timed && (
        <div
          className={cn('ps-toast-bar absolute bottom-0 left-0 h-[2px] w-full origin-left', tone.bar)}
          style={{ animationDuration: `${toast.duration}ms` }}
          onAnimationEnd={() => dismiss(toast.id)}
        />
      )}
    </motion.div>
  );
}

/**
 * Every toast on screen. Mounted once, at the root.
 *
 * A portal on `document.body` rather than a node in the tree: the dashboard shell clips
 * and scrolls its own columns, and a fixed element inside a `transform`ed ancestor is
 * positioned against that ancestor, not the viewport — which is how these end up halfway
 * up the page on one route and off-screen on another.
 *
 * Top centre. The right-hand corner is spoken for — the advisor rail, the ask-about-this-
 * audit button, and on a phone the two of them together — and a notification that has to be
 * squeezed past furniture ends up somewhere different on every screen size. The top of the
 * page is the same place everywhere.
 *
 * Newest first, so the newest card is the one nearest the top edge and the stack grows
 * downwards away from it.
 */
export function Toaster() {
  const toasts = useToastStore(s => s.toasts);

  // A toast raised while the reader is in another tab should still be there when they come
  // back. CSS animations keep running on a hidden document, so the countdown — which is
  // what dismisses the toast — has to be told to stop.
  const [backgrounded, setBackgrounded] = useState(false);
  useEffect(() => {
    const onChange = () => setBackgrounded(document.visibilityState === 'hidden');
    onChange();
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      // Polite: a toast is a confirmation, not an interruption. Errors carry role="alert"
      // individually, which is assertive on its own.
      aria-live="polite"
      aria-relevant="additions"
      className={cn(
        'pointer-events-none fixed z-[100] top-[18px] left-1/2 -translate-x-1/2',
        // Below the mobile topbar, which owns the top of the screen there.
        'max-md:top-[68px]',
        'flex flex-col items-center gap-[10px]',
        backgrounded && 'ps-toasts-paused',
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {[...toasts].reverse().map(t => <ToastCard key={t.id} toast={t} />)}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
