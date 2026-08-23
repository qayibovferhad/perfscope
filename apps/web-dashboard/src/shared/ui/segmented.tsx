import { useId } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface SegmentOption<T> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Tooltip — the place to explain what the option actually does. */
  title?: string;
}

interface Props<T extends string> {
  options:   SegmentOption<T>[];
  value:     T;
  onChange:  (v: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  /** `sm` is for in-panel filter strips; the default fits page-level toolbars. */
  size?: 'default' | 'sm';
}

/**
 * (Icon +) label radio group styled as one control.
 *
 * The active background is one `motion.span` shared across every option via `layoutId`,
 * not a class toggled per-button — switching the class made the highlight jump straight
 * to the new option with nothing in between; framer-motion animates the same element's
 * position and size instead, so it visibly slides. `useId` keys the layoutId per mounted
 * instance so two Segmented controls on the same page (device profile, precision) never
 * share one and animate into each other.
 */
export function Segmented<T extends string>({
  options, value, onChange, disabled = false, ariaLabel, className, size = 'default',
}: Props<T>) {
  const layoutId = useId();
  const btnSize = size === 'sm'
    ? 'text-[11px] px-[9px] py-[4px] rounded-[7px]'
    : 'text-[12px] px-[11px] py-[6px] rounded-[8px]';
  return (
    <div
      // `max-w-full` + horizontal scroll rather than wrapping: five category chips on a
      // phone were squeezing "Best practices 2" onto two lines and making the control twice
      // as tall as the rows it filters. `shrink-0` on the buttons is what forces the scroll
      // instead of the squeeze; the scrollbar is hidden because the chips are the affordance.
      className={`inline-flex max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                  rounded-[10px] border border-ld-border-strong bg-ld-surface-2 p-[3px] ${className ?? ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map(({ value: v, label, icon: Icon, title }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            title={title}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`relative inline-flex shrink-0 items-center gap-[6px] whitespace-nowrap font-semibold transition-colors duration-150 disabled:opacity-50 ${btnSize} ${
              active ? 'text-ld-accent-2' : 'text-ld-text-3 hover:text-ld-text-2'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${layoutId}`}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                className="absolute inset-0 rounded-[8px] bg-ld-accent-soft [box-shadow:inset_0_0_0_1px_var(--ld-accent-line)]"
              />
            )}
            <span className="relative inline-flex items-center gap-[6px]">
              {Icon && <Icon className="w-[13px] h-[13px]" />}
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
