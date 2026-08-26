import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, daysBetween, dayKeyOf, type OverviewRange } from '@perfscope/shared';
import { cn } from '@/shared/lib/utils';

/**
 * Pick a window: a preset, or two clicks on a calendar.
 *
 * Written from scratch, like the ⌘K palette and the toaster before it. A range picker is a
 * month grid, two clicks and a hover — `react-day-picker` and its locale machinery is
 * several times the size of what is on screen here, and this one has to speak the
 * product's own day keys rather than `Date` objects in the viewer's zone (see
 * `overviewRange` for why that distinction is load-bearing).
 *
 * **Days are plain `YYYY-MM-DD` strings throughout.** No `Date` maths on the grid, no
 * timezone conversion anywhere: the reader clicks the 3rd of August and the server is asked
 * about the 3rd of August. The one place a `Date` appears is `dayKeyOf(new Date())` to find
 * today, which is the only genuinely local question here.
 *
 * The panel is portalled to the body because the dashboard's controls row sits inside a
 * column that clips — the same reason the notification bell is portalled.
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface RangePreset {
  days:  number;
  label: string;
}

/** The month a day key belongs to, as `[year, monthIndex]`. */
const monthOf = (day: string): [number, number] => {
  const [y, m] = day.split('-').map(Number) as [number, number, number];
  return [y, m - 1];
};

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (year: number, month: number, date: number) => `${year}-${pad(month + 1)}-${pad(date)}`;

/** Monday-first weekday index of the 1st, so the grid starts where a European calendar does. */
function leadingBlanks(year: number, month: number): number {
  return (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** "1 day", "30 days" — a control that reads "1 days" looks like a placeholder. */
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** "24 Aug" / "24 Aug 2025" — the year only when it is not this one, which is most of the
 *  time not worth the width. */
function shortDay(day: string, thisYear: string): string {
  const [y, m, d] = day.split('-') as [string, string, string];
  const month = MONTHS[Number(m) - 1]?.slice(0, 3) ?? m;
  return `${Number(d)} ${month}${y === thisYear ? '' : ` ${y}`}`;
}

/** What the trigger says: a preset by name, or the range itself. */
export function rangeLabel(range: OverviewRange, presets: RangePreset[], today: string): string {
  const preset = range.to === today && presets.find(p => p.days === range.days);
  if (preset) return preset.label;
  return range.from === range.to
    ? shortDay(range.from, today.slice(0, 4))
    : `${shortDay(range.from, today.slice(0, 4))} – ${shortDay(range.to, today.slice(0, 4))}`;
}

interface Props {
  range:    OverviewRange;
  presets:  RangePreset[];
  /** A preset was chosen — the caller usually writes `?days=` and drops `from`/`to`. */
  onPreset: (days: number) => void;
  /** Two days were picked — the caller writes `?from=&to=`. */
  onRange:  (from: string, to: string) => void;
  className?: string;
}

export function DateRangePicker({ range, presets, onPreset, onRange, className }: Props) {
  const today = useMemo(() => dayKeyOf(new Date()), []);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  /** The first click of a pending pair. Null means the next click starts a new range. */
  const [pending, setPending] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [[year, month], setMonth] = useState<[number, number]>(() => monthOf(range.to));

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // Re-anchored on open rather than positioned once: the controls row moves when the
  // storage banner appears and when the window is resized.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const box = triggerRef.current?.getBoundingClientRect();
      if (box) setAnchor({ top: box.bottom + 8, left: box.left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Click-away has to know about both halves: the panel is portalled, so it is not inside
  // the trigger's subtree and a plain "clicked outside me" check closes it on its own
  // buttons.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  });

  function close() {
    setOpen(false);
    // A half-made range is abandoned, not applied: one click is not a window.
    setPending(null);
    setHovered(null);
  }

  function toggle() {
    if (open) { close(); return; }
    setMonth(monthOf(range.to));
    setOpen(true);
  }

  function pick(day: string) {
    if (day > today) return;                      // nobody has measured tomorrow
    if (!pending) { setPending(day); return; }

    const [from, to] = pending <= day ? [pending, day] : [day, pending];
    setPending(null);
    setHovered(null);
    setOpen(false);
    onRange(from, to);
  }

  function choosePreset(days: number) {
    setPending(null);
    setOpen(false);
    onPreset(days);
  }

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(year, month + delta, 1));
    setMonth([next.getUTCFullYear(), next.getUTCMonth()]);
  }

  // While the second click is pending, the range under the cursor is the one being drawn —
  // otherwise the grid shows the range that is actually applied.
  const [selFrom, selTo] = pending
    ? (hovered && hovered < pending ? [hovered, pending] : [pending, hovered ?? pending])
    : [range.from, range.to];

  const cells = [
    ...Array.from({ length: leadingBlanks(year, month) }, () => null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) => keyOf(year, month, i + 1)),
  ];

  const canGoForward = keyOf(year, month, 1) < keyOf(...monthOf(today), 1);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        // The visible text has to be *part of* the accessible name, or the two disagree and
        // a voice-control user saying "click 30 days" hits nothing. Lighthouse calls this
        // label-content-name-mismatch, and it was the dashboard's only failing audit.
        aria-label={`Time range: ${rangeLabel(range, presets, today)}`}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-[7px] h-[32px] px-[11px] rounded-[10px] cursor-pointer',
          'border text-[12.5px] font-semibold transition-colors',
          open
            ? 'border-ld-accent-line bg-ld-accent-soft text-ld-accent'
            : 'border-ld-border bg-ld-surface text-ld-text-2 hover:border-ld-border-strong hover:text-ld-text',
          className,
        )}
      >
        <CalendarDays className="w-[14px] h-[14px] shrink-0" />
        {rangeLabel(range, presets, today)}
      </button>

      {open && anchor && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose a date range"
          style={{ top: anchor.top, left: anchor.left }}
          className="fixed z-50 w-[290px] rounded-[14px] border border-ld-border-strong bg-ld-surface
                     shadow-[0_30px_80px_-24px_rgba(0,0,0,.6)] overflow-hidden"
        >
          <div className="flex flex-wrap gap-1.5 p-[10px] border-b border-ld-border">
            {presets.map(preset => {
              const active = range.to === today && range.days === preset.days;
              return (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => choosePreset(preset.days)}
                  className={cn(
                    'px-[9px] h-[26px] rounded-[8px] text-[11.5px] font-semibold cursor-pointer transition-colors border',
                    active
                      ? 'border-ld-accent-line bg-ld-accent-soft text-ld-accent'
                      : 'border-transparent bg-ld-surface-2 text-ld-text-2 hover:text-ld-text',
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-[12px] py-[9px]">
            <button
              type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month"
              className="w-[24px] h-[24px] grid place-items-center rounded-[7px] cursor-pointer text-ld-text-3 hover:bg-ld-surface-2 hover:text-ld-text"
            >
              <ChevronLeft className="w-[14px] h-[14px]" />
            </button>
            <span className="text-[12.5px] font-semibold text-ld-text">{MONTHS[month]} {year}</span>
            <button
              type="button" onClick={() => shiftMonth(1)} aria-label="Next month" disabled={!canGoForward}
              className="w-[24px] h-[24px] grid place-items-center rounded-[7px] cursor-pointer text-ld-text-3
                         hover:bg-ld-surface-2 hover:text-ld-text disabled:cursor-default disabled:text-ld-border-strong disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-[14px] h-[14px]" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-[2px] px-[10px] pb-[10px]" onMouseLeave={() => setHovered(null)}>
            {WEEKDAYS.map(w => (
              <span key={w} className="h-[22px] grid place-items-center text-[9.5px] font-bold uppercase tracking-wider text-ld-text-3">
                {w}
              </span>
            ))}

            {cells.map((day, i) => {
              if (!day) return <span key={`blank-${i}`} />;

              const future   = day > today;
              const inRange  = day >= selFrom && day <= selTo;
              const isEdge   = day === selFrom || day === selTo;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={future}
                  onClick={() => pick(day)}
                  onMouseEnter={() => setHovered(day)}
                  aria-label={day}
                  aria-current={isEdge ? 'date' : undefined}
                  className={cn(
                    'h-[28px] grid place-items-center text-[12px] font-mono tabular-nums transition-colors',
                    // The edges are solid, the middle is a wash — a range reads as one shape
                    // rather than as a row of separate selected squares.
                    isEdge  ? 'bg-ld-accent text-ld-grad-text font-bold rounded-[7px]'
                    // `soft` (.12), not `wash` (.06): measured on both themes, the wash was
                    // invisible on white and the band read as two lonely selected squares.
                    : inRange ? 'bg-ld-accent-soft text-ld-text'
                    : 'text-ld-text-2 hover:bg-ld-surface-2 rounded-[7px]',
                    day === today && !isEdge && 'text-ld-accent font-bold',
                    future && 'text-ld-border-strong cursor-default hover:bg-transparent',
                    !future && 'cursor-pointer',
                  )}
                >
                  {Number(day.slice(8))}
                </button>
              );
            })}
          </div>

          <p className="px-[12px] pb-[10px] text-[10.5px] text-ld-text-3">
            {pending
              ? 'Now pick the end of the range.'
              : `${plural(daysBetween(range.from, range.to), 'day')} · ends ${range.to === today ? 'today' : shortDay(range.to, today.slice(0, 4))}`}
          </p>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Re-exported for callers that build a preset's range themselves. */
export { addDays };
