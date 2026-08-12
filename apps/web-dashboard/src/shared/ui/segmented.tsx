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

/** (Icon +) label radio group styled as one control. */
export function Segmented<T extends string>({
  options, value, onChange, disabled = false, ariaLabel, className, size = 'default',
}: Props<T>) {
  const btnSize = size === 'sm'
    ? 'text-[11px] px-[9px] py-[4px] rounded-[7px]'
    : 'text-[12px] px-[11px] py-[6px] rounded-[8px]';
  return (
    <div
      className={`inline-flex rounded-[10px] border border-ld-border-strong bg-ld-surface-2 p-[3px] ${className ?? ''}`}
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
            className={`inline-flex items-center gap-[6px] font-semibold transition-all duration-150 disabled:opacity-50 ${btnSize} ${
              active
                ? 'bg-ld-accent-soft text-ld-accent-2 [box-shadow:inset_0_0_0_1px_var(--ld-accent-line)]'
                : 'text-ld-text-3 hover:text-ld-text-2'
            }`}
          >
            {Icon && <Icon className="w-[13px] h-[13px]" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
