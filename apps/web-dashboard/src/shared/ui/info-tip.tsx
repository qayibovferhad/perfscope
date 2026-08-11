import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, type LucideIcon } from 'lucide-react';

/**
 * The (i) affordance and its explanation panel.
 *
 * Rendered through a portal to `document.body` rather than positioned inside its parent.
 * The panel is 248px of prose and its triggers sit inside cards that clip
 * (`ScoreCard` is `overflow-hidden`, and framer's transform on those cards creates a
 * containing block regardless), so an absolutely-positioned child would be cut off or
 * stack unpredictably. This is the same failure `shared/ui/modal/Modal.tsx` documents,
 * and the same fix.
 */

/** Fixed width, so positioning never has to measure the panel. */
const PANEL_W = 248;
const HALF    = PANEL_W / 2;
const EDGE    = 12;
/** Below this much room above the trigger, the panel flips underneath it. */
const FLIP_ABOVE_PX = 160;

interface Props {
  /** Explanation body. Static content — the panel does not take pointer events. */
  content: React.ReactNode;
  /** Accessible name for the trigger, e.g. "About Largest Contentful Paint". */
  label:   string;
  /**
   * Trigger glyph. Defaults to (i); a caller whose tip explains a *problem* rather than a
   * term passes its own, so the icon keeps meaning what it meant beside its neighbours.
   */
  icon?:   LucideIcon;
  className?: string;
}

export function InfoTip({ content, label, icon: Icon = Info, className }: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  /**
   * Edge offsets, never a centre point plus a CSS translate: framer-motion writes its
   * animation to the inline `transform`, which silently wins over a `-translate-x-1/2`
   * class and leaves every panel half its width off to the right. Anchoring the *bottom*
   * edge for the flipped case also avoids having to measure the panel's height.
   */
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  /** A tap fires mouseenter *then* click; without this the click would close it again. */
  const touchRef = useRef(false);

  function place() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.top < FLIP_ABOVE_PX;
    // Clamped so a trigger near the viewport edge cannot push the panel off-screen.
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - HALF, EDGE),
      window.innerWidth - PANEL_W - EDGE,
    );
    setPos(below
      ? { left, top: rect.bottom + 8 }
      : { left, bottom: window.innerHeight - rect.top + 8 });
  }

  function show() { place(); setOpen(true); }

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // Repositioning on scroll would fight the page; a tooltip should simply go away.
    const close = () => setOpen(false);
    const onPointerDown = (e: PointerEvent) => {
      if (!triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        {...(open ? { 'aria-describedby': id } : {})}
        onPointerDown={(e) => { touchRef.current = e.pointerType !== 'mouse'; }}
        onMouseEnter={show}
        onMouseLeave={() => { if (!touchRef.current) setOpen(false); }}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={() => {
          if (!touchRef.current) return;
          if (open) setOpen(false);
          else show();
        }}
        className={`inline-flex items-center shrink-0 rounded-full cursor-help text-ld-text-3 transition-colors duration-150 hover:text-ld-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ld-accent-line)] ${className ?? ''}`}
      >
        <Icon className="w-[13px] h-[13px]" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              id={id}
              role="tooltip"
              initial={{ opacity: 0, y: pos.top !== undefined ? -4 : 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.top !== undefined ? -4 : 4, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              // z-250 clears the modal scrim (200) so tips work inside a dialog, and
              // stays under the select dropdown (300).
              className="fixed z-[250] w-[248px] pointer-events-none"
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
            >
              <div className="rounded-[10px] bg-ld-surface border border-ld-border shadow-ld-shadow-card px-[12px] py-[10px] text-[12px] text-ld-text-2 leading-relaxed">
                {content}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
