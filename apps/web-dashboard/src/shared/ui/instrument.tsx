import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';

/**
 * The instrument vocabulary — the pieces that make a page read as a measuring device
 * rather than as another arrangement of rounded boxes.
 *
 * Every page in this app was built from the same three moves: a title block, four
 * equal stat cards, then panels. The layout was consistent, which is good, and
 * *identical*, which is why nothing had a character of its own. These are the parts a
 * page reaches for instead: a dial for the one number it exists to report, a readout
 * row for the numbers beside it, and a field to stand them on.
 *
 * They live in `shared` because five pages draw a dial and four draw a readout strip;
 * they take colour as a `tone` rather than importing the band maps, since `shared` sits
 * below `entities` and may not reach up into them (the same reason `StatCard` takes
 * class names).
 */

/**
 * `teal` is not a verdict — it is the second *subject* colour.
 *
 * good/warn/poor say how a number is doing; accent and teal say which number it is. A
 * strip of three readings all in the same emerald reads as one undifferentiated block,
 * which is what made these bands feel flat even after they stopped being stat cards.
 */
export type InstrumentTone = 'good' | 'warn' | 'poor' | 'accent' | 'teal' | 'neutral';

const TONE_STROKE: Record<InstrumentTone, string> = {
  good:    'var(--ld-accent)',
  warn:    'var(--ld-amber)',
  poor:    'var(--ld-rose)',
  accent:  'var(--ld-accent)',
  teal:    'var(--ld-teal)',
  neutral: 'var(--ld-border-strong)',
};

/** The faintest step of each family — a field a number stands on, never a fill. */
const TONE_WASH: Record<InstrumentTone, string> = {
  good:    'var(--ld-accent-wash)',
  warn:    'var(--ld-amber-wash)',
  poor:    'var(--ld-rose-wash)',
  accent:  'var(--ld-accent-wash)',
  teal:    'var(--ld-teal-wash)',
  neutral: 'transparent',
};

const TONE_TEXT: Record<InstrumentTone, string> = {
  good:    'text-ld-score-good',
  warn:    'text-ld-amber',
  poor:    'text-ld-rose',
  accent:  'text-ld-accent',
  teal:    'text-ld-teal',
  neutral: 'text-ld-text-3',
};

// ─── Ruler ───────────────────────────────────────────────────────────────────

/**
 * The tick strip under a page title.
 *
 * Drawn by `.ps-ruler` (two repeating gradients), not by 40 spans — it appears on every
 * route, and as elements it would be a thousand nodes that say nothing to a reader.
 * `aria-hidden` for the same reason: it is the page's texture, not its content.
 */
export function Ruler({ className }: { className?: string }) {
  return <div aria-hidden className={cn('ps-ruler w-full', className)} />;
}

// ─── Count-up ────────────────────────────────────────────────────────────────

/**
 * A number that arrives by counting rather than by appearing.
 *
 * A dashboard whose figures are simply *there* on paint looks rendered; one whose
 * figures settle looks measured. Capped at 900ms and skipped entirely under
 * `prefers-reduced-motion`, where the final value is painted immediately — the
 * animation is decoration, and the number is the content.
 */
export function CountUp({
  value, decimals = 0, className,
}: { value: number; decimals?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const from = useRef(0);
  // Reduced motion paints the value straight from the prop — the counter's state is never
  // touched, so there is no setState in the effect to schedule a second render.
  const shown = reduce ? value : animated;

  useEffect(() => {
    if (reduce) return;
    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      // easeOutCubic: fast enough to feel like a needle settling, not a progress bar.
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(origin + delta * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  return (
    <span className={cn('tabular-nums', className)}>
      {shown.toFixed(decimals)}
    </span>
  );
}

// ─── Dial ────────────────────────────────────────────────────────────────────

const SIZES = {
  sm: { box: 60,  stroke: 6,  font: 'text-[15px]', unit: 'text-[9px]'  },
  md: { box: 92,  stroke: 7,  font: 'text-[24px]', unit: 'text-[10px]' },
  lg: { box: 116, stroke: 8,  font: 'text-[32px]', unit: 'text-[11px]' },
  /** The compare page's headline, where one dial per side is the whole screen. */
  xl: { box: 168, stroke: 11, font: 'text-[46px]', unit: 'text-[12px]' },
} as const;

/** Polar → cartesian in a 100×100 box, degrees measured from 12 o'clock, clockwise. */
function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
}

/** The 270° track, bottom-left to bottom-right over the top. */
function arcPath(r: number): string {
  const [sx, sy] = polar(r, 225);
  const [ex, ey] = polar(r, 135);
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

const TRACK = arcPath(38);
/** 11 ticks across the sweep — a scale you can read a rough value off without the numeral. */
const TICKS = Array.from({ length: 11 }, (_, i) => {
  const deg = 225 + (i * 270) / 10;
  const [x1, y1] = polar(43, deg);
  const [x2, y2] = polar(i % 5 === 0 ? 49 : 46, deg);
  return { x1, y1, x2, y2, major: i % 5 === 0 };
});

interface DialProps {
  /** `null` is "never measured" — an empty track, never a zero reading. */
  value: number | null;
  max?: number;
  tone?: InstrumentTone;
  size?: keyof typeof SIZES;
  /** Small mono caption inside the dial, under the numeral ("avg", "ms", "%"). */
  unit?: string;
  /** Accessible name — a dial with no text beside it needs one. */
  label?: string;
  /** Draw a sweeping needle instead of a value: a reading that has not landed yet. */
  pending?: boolean;
  /** Printed in place of the numeral — an icon, for a dial standing in as an illustration. */
  glyph?: React.ReactNode;
  /** Ornamental: the dial repeats something the text beside it already says. */
  decorative?: boolean;
  className?: string;
}

/**
 * A 270° gauge — the app's signature object.
 *
 * `ScoreRing` (entities/analysis) stays what it is: a compact closed ring for a score in
 * a list row. This is the *instrument* form — an open sweep with a printed scale, for the
 * one number a page is about. The two are deliberately different shapes so a page's
 * headline reading and its row-level scores never read as the same weight of claim.
 */
export function Dial({
  value, max = 100, tone = 'accent', size = 'md', unit, label, pending = false,
  glyph, decorative = false, className,
}: DialProps) {
  const reduce = useReducedMotion();
  const s = SIZES[size];
  const p = value === null ? 0 : Math.max(0, Math.min(1, value / max));

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: s.box, height: s.box }}
      // A dial drawn beside a sentence that already states the reading is ornament, and
      // announcing it a second time is noise in a screen reader, not redundancy.
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label ?? (value === null ? 'Not measured' : `${value} of ${max}`) })}
    >
      <svg viewBox="0 0 100 100" width={s.box} height={s.box} aria-hidden>
        {TICKS.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.major ? 'rgba(var(--ld-accent-rgb), 0.45)' : 'var(--ld-border-strong)'}
            strokeWidth={t.major ? 1.4 : 1}
            strokeLinecap="round"
          />
        ))}

        <path
          d={TRACK}
          fill="none"
          stroke="var(--ld-border)"
          strokeWidth={s.stroke}
          strokeLinecap="round"
        />

        {pending ? (
          // A needle going round: the dial is live and the number has not arrived. Far
          // better here than a spinner — it is the same object the value will land in.
          <g className="ps-sweep">
            <line
              x1="50" y1="50" x2="50" y2="16"
              stroke="var(--ld-accent)" strokeWidth="2" strokeLinecap="round" opacity="0.7"
            />
          </g>
        ) : value !== null && (
          <motion.path
            d={TRACK}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={s.stroke}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            initial={{ strokeDashoffset: reduce ? 1 - p : 1 }}
            animate={{ strokeDashoffset: 1 - p }}
            transition={{ duration: reduce ? 0 : 0.9, ease: 'easeOut' }}
          />
        )}
      </svg>

      <div className="absolute inset-0 grid place-content-center text-center leading-none">
        {glyph ? (
          <span className={cn('grid place-items-center', TONE_TEXT[tone])}>{glyph}</span>
        ) : (
          <b className={cn('font-mono font-semibold tracking-[-0.03em]', s.font, TONE_TEXT[tone])}>
            {value === null ? '—' : <CountUp value={value} />}
          </b>
        )}
        {unit && (
          <span className={cn('font-mono uppercase tracking-[.16em] text-ld-text-3 mt-[5px] block', s.unit)}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Readout ─────────────────────────────────────────────────────────────────

interface ReadoutProps {
  label: string;
  value: React.ReactNode;
  /** Unit or qualifier printed after the value, smaller ("ms", "sites", "/ 100"). */
  unit?: string;
  tone?: InstrumentTone;
  /** One line under the label — what the number is counted over. */
  sub?: React.ReactNode;
  /** 0..1 — fills the tick baseline under the number. Omit for a bare reading. */
  fill?: number;
  /** Paint the cell in its tone: a 2px cap above it and a wash behind it. Off by default,
   *  because a band where every cell is tinted is a band with no emphasis left. */
  tint?: boolean;
  className?: string;
}

/**
 * One reading in a strip: a mono numeral over a labelled tick baseline.
 *
 * The baseline is the point. `StatCard` reports a number in a box; this reports it
 * *against a scale*, so "62" and "98" are different lengths of bar before you have read
 * either of them. Pages keep `StatCard` for counts that have no scale (sites tracked,
 * audits run) and use this where the number sits somewhere between two ends.
 */
export function Readout({
  label, value, unit, tone = 'neutral', sub, fill, tint = false, className,
}: ReadoutProps) {
  return (
    // `data-readout` is a probe hook, like `data-print` elsewhere: the mobile layout
    // probe has to find the readings to assert they sit two-up, and class names are not a
    // contract anything should be selecting on.
    <div
      data-readout
      className={cn(
        'relative min-w-0 h-full flex flex-col justify-center px-[18px] py-[16px] max-sm:px-[14px] max-sm:py-[12px]',
        className,
      )}
      style={tint ? { background: TONE_WASH[tone] } : undefined}
    >
      {/* The cap. It is what gives a row of readings a colour rhythm at a glance — the
          numbers themselves are too small to carry one, and tinting the whole cell hard
          enough to read would put a coloured field under text tuned for the surface. */}
      {tint && tone !== 'neutral' && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: TONE_STROKE[tone] }}
        />
      )}
      <div className="flex items-baseline gap-[6px] min-w-0">
        <b className={cn(
          'font-mono text-[26px] max-sm:text-[22px] font-semibold tracking-[-0.03em] leading-none tabular-nums',
          TONE_TEXT[tone],
        )}>
          {value}
        </b>
        {unit && <span className="font-mono text-[11px] text-ld-text-3 shrink-0">{unit}</span>}
      </div>

      {/* The scale. A 2px rule the value paints over — present even at fill 0, because a
          bar that disappears when the number is bad hides exactly the case you want to
          see. Hidden from assistive tech: it restates the number beside it. */}
      {fill !== undefined && (
        <div aria-hidden className="mt-[10px] h-[3px] w-full max-w-[130px] rounded-full bg-ld-border overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: TONE_STROKE[tone] }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* The label stays `--ld-text-3` even in a tinted cell. At 10.5px it is small text,
          and in the light theme the accent and teal families measure about 3.4:1 on white
          — fine for the 26px numeral above it (large text, 3:1), not for this. The cap and
          the number carry the colour; the label carries the contrast. */}
      <span className="block mt-[9px] font-mono text-[10.5px] uppercase tracking-[.16em] text-ld-text-3">
        {label}
      </span>
      {sub && <span className="block mt-[4px] text-[11.5px] text-ld-text-3">{sub}</span>}
    </div>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────

/**
 * The graph-paper slab a page's leading numbers stand on.
 *
 * Crop marks are opt-in (`marks`) rather than automatic: four of them on every block on
 * a page is a pattern, and a pattern stops pointing at anything. One field per page.
 */
export function InstrumentField({
  children, marks = true, className,
}: { children: React.ReactNode; marks?: boolean; className?: string }) {
  return (
    <div className={cn(
      'ps-grid-field rounded-[18px] border border-ld-border bg-ld-surface/60 overflow-hidden',
      marks && 'ps-marks',
      className,
    )}>
      {children}
    </div>
  );
}

// ─── Band ────────────────────────────────────────────────────────────────────

interface BandProps {
  /** The page's headline reading: the dial, and what it is of. */
  reading: {
    value: number | null;
    max?: number;
    tone?: InstrumentTone;
    /** Mono label beside the dial — "AVG SCORE", "WORST STEP". */
    label: string;
    /** One line under it: what the reading is taken over. */
    caption?: React.ReactNode;
    /** Accessible name for the dial itself. */
    ariaLabel?: string;
    pending?: boolean;
  };
  /** `Readout`s — three, at most four. Divided by hairlines by the band, not by each. */
  children: React.ReactNode;
  className?: string;
}

/**
 * A page's leading block: one dial, then the counts that qualify it, on graph paper.
 *
 * Shared because three pages open with exactly this object and a second copy would drift
 * in padding and breakpoints within a week — which is the failure the whole page pass is
 * undoing, not one to re-commit here. What differs per page is the *reading*, which is
 * the argument.
 */
export function InstrumentBand({ reading, children, className }: BandProps) {
  return (
    <InstrumentField className={className}>
      <div className="flex items-stretch max-[880px]:flex-col">
        <div className="relative flex items-center gap-[18px] px-[24px] py-[18px] max-sm:px-[16px] shrink-0">
          {/* A glow under the dial in the band's own verdict colour: on a page of hairlines
              and grey grid it is the one place colour is allowed to spread, and it is what
              makes a red account look red before a number has been read. */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 w-[140px] h-[140px] rounded-full blur-[54px] opacity-[.16]"
            style={{ background: reading.tone === 'neutral' || !reading.tone
              ? 'transparent'
              : TONE_STROKE[reading.tone] }}
          />
          <Dial
            value={reading.value}
            max={reading.max}
            tone={reading.tone}
            size="lg"
            pending={reading.pending}
            label={reading.ariaLabel}
          />
          <div className="min-w-0">
            <span className="block font-mono text-[10.5px] uppercase tracking-[.18em] text-ld-text-3">
              {reading.label}
            </span>
            {reading.caption && (
              <span className="block text-[13px] text-ld-text-2 mt-[7px] leading-snug">
                {reading.caption}
              </span>
            )}
          </div>
        </div>

        {/* Hairlines rather than boxes: these are readings off one instrument, and four
            separate cards said they were four subjects. `divide-*` so a band does not
            care how many readouts a page gives it. */}
        {/* Two across on a phone rather than one: stacked, three readouts made the band
            most of the first screen, and the dashboard's charts started below the fold. */}
        <div className="flex-1 grid auto-cols-fr grid-flow-col divide-x divide-ld-border
                        border-l border-ld-border
                        max-[880px]:border-l-0 max-[880px]:border-t
                        max-[560px]:grid-flow-row max-[560px]:grid-cols-2
                        max-[560px]:[&>*]:border-t max-[560px]:[&>*]:border-ld-border
                        max-[560px]:divide-x-0">
          {children}
        </div>
      </div>
    </InstrumentField>
  );
}
