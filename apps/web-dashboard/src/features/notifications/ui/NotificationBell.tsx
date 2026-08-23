import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Bell, CheckCircle2, TrendingDown } from 'lucide-react';
import { alertEventLabel } from '@perfscope/shared';
import { cn } from '@/shared/lib/utils';
import { timeAgo } from '@/shared/lib/time';
import { getHostname } from '@/entities/website';
import { useNotifications } from '../model/useNotifications';

/** Past this the badge stops being a count and becomes "a lot". */
const BADGE_CAP = 9;

const PANEL_WIDTH = 340;
/** Breathing room from the bell, and from the window edge when the panel is clamped. */
const PANEL_GAP = 8;
const VIEWPORT_MARGIN = 12;

/** A breach and a recovery are the same event seen from two sides; the icon says which. */
function statusIcon(status: string) {
  if (status === 'recovered') return { Icon: CheckCircle2, cls: 'text-[var(--ld-accent)] border-[var(--ld-accent-line)] bg-[var(--ld-accent-soft)]' };
  if (status === 'firing')    return { Icon: AlertTriangle, cls: 'text-ld-rose border-[var(--ld-rose-line)] bg-[var(--ld-rose-soft)]' };
  return { Icon: TrendingDown, cls: 'text-ld-amber border-[var(--ld-amber-line)] bg-[var(--ld-amber-soft)]' };
}

/**
 * What has been raised for this account, in the shell, on every page.
 *
 * Alerts have always been recorded and delivered — to a webhook, to an inbox — and until
 * now the product itself never mentioned them. Someone whose nightly audit tripped a
 * target could open the dashboard the next morning and see nothing about it unless they
 * went looking on the right page.
 *
 * Opening the panel is what marks things read, not receiving them: the query refetches on
 * a timer and on window focus, and clearing the badge on a refetch would clear it while
 * the tab sat in the background.
 */
export function NotificationBell() {
  const { entries, unread, isLoading, markSeen } = useNotifications();
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  /**
   * Where to put the panel, in viewport coordinates.
   *
   * It is rendered in a portal rather than beside the button, because the sidebar it lives
   * in is `overflow-y-auto` — a scroll container clips its children in *both* axes, so an
   * absolutely-positioned dropdown wider than the sidebar is simply cut off at its edge.
   * That is not fixable with `left`/`right`; it has to leave the container.
   */
  const place = useCallback(() => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
    setAnchor({
      top:  rect.bottom + PANEL_GAP,
      left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft)),
    });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  // The sidebar scrolls under the panel and the window resizes; a dropdown left behind by
  // either is worse than one that simply follows.
  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  // Click-away and Escape. A dropdown in a sidebar that only closes by clicking the bell
  // again is one every user ends up fighting.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Both, because the panel is portalled to `document.body` and is therefore not a
      // descendant of the bell — checking only the bell would close the panel on every
      // click *inside* it, including the scrollbar.
      if (wrap.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markSeen();
  }

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className={cn(
          'w-[36px] h-[36px] grid place-items-center rounded-[11px] border transition-colors bg-transparent cursor-pointer relative',
          open
            ? 'text-ld-accent border-ld-accent-line bg-ld-accent-soft'
            : 'text-ld-text-3 border-transparent hover:text-ld-text hover:border-ld-border hover:bg-ld-surface',
        )}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <motion.span
            // The badge is the only thing on this screen that appears without being asked
            // for, so it announces itself once and then stays still.
            initial={reduced ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            className="absolute -top-[3px] -right-[3px] min-w-[17px] h-[17px] px-[4px] rounded-full
                       grid place-items-center font-mono text-[10px] font-bold leading-none
                       text-white bg-ld-rose border-2 border-ld-bg-2"
          >
            {unread > BADGE_CAP ? `${BADGE_CAP}+` : unread}
          </motion.span>
        )}
      </button>

      {createPortal(
      <AnimatePresence>
        {open && anchor && (
          <motion.div
            ref={panel}
            role="dialog"
            aria-label="Notifications"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ top: anchor.top, left: anchor.left, width: PANEL_WIDTH }}
            className="fixed z-[90] max-h-[420px] flex flex-col
                       rounded-[14px] border border-ld-border-strong bg-ld-surface shadow-ld-shadow-card overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-[14px] py-[11px] border-b border-ld-border">
              <span className="font-mono text-[10.5px] tracking-[.14em] uppercase text-ld-text-3">
                Notifications
              </span>
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="font-mono text-[11px] text-ld-accent hover:underline"
              >
                Open incidents
              </Link>
            </div>

            <div className="overflow-y-auto">
              {isLoading && (
                <p className="font-mono text-[12px] text-ld-text-3 text-center py-[26px] m-0">Loading…</p>
              )}

              {!isLoading && entries.length === 0 && (
                <div className="px-[16px] py-[26px] text-center">
                  <p className="text-[13px] text-ld-text-2 m-0">Nothing has been raised yet.</p>
                  <p className="text-[12px] text-ld-text-3 mt-[5px] m-0">
                    Set a target on a site and its audits will report here when they miss it.
                  </p>
                </div>
              )}

              {entries.map((entry) => {
                const { Icon, cls } = statusIcon(entry.status);
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'flex items-start gap-[10px] px-[14px] py-[11px] border-b border-ld-border last:border-b-0',
                      // Unread is a tint, not a dot: the whole row is what changed, and a
                      // dot beside forty rows is a puzzle rather than a signal.
                      entry.unread && 'bg-ld-accent-wash',
                    )}
                  >
                    <span className={cn('w-[24px] h-[24px] shrink-0 rounded-[7px] grid place-items-center border', cls)}>
                      <Icon className="w-[13px] h-[13px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ld-text m-0 leading-snug">
                        {alertEventLabel(entry.event)}
                        {entry.metrics.length > 0 && (
                          <span className="font-mono text-[11px] font-medium text-ld-text-3">
                            {' · '}{entry.metrics.join(', ').toUpperCase()}
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-ld-text-2 truncate m-0 mt-[2px]" title={entry.url}>
                        {getHostname(entry.url)}
                      </p>
                      {entry.lines[0] && (
                        <p className="font-mono text-[11.5px] text-ld-text-3 mt-[3px] m-0 line-clamp-2">
                          {entry.lines[0]}
                        </p>
                      )}
                      <p className="font-mono text-[10.5px] text-ld-text-3 mt-[4px] m-0">{timeAgo(entry.at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </div>
  );
}
