import type { LucideIcon } from 'lucide-react';

export interface SegmentOption<T> {
  value: T;
  label: string;
  icon:  LucideIcon;
  /** Tooltip — the place to explain what the option actually does. */
  title: string;
}

interface Props<T extends string> {
  options:   SegmentOption<T>[];
  value:     T;
  onChange:  (v: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}

/** Icon + label radio group styled as one control. */
export function Segmented<T extends string>({
  options, value, onChange, disabled = false, ariaLabel, className,
}: Props<T>) {
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
            className={`inline-flex items-center gap-[6px] text-[12px] font-semibold px-[11px] py-[6px] rounded-[8px] transition-all duration-150 disabled:opacity-50 ${
              active
                ? 'bg-ld-accent-soft text-ld-accent-2 [box-shadow:inset_0_0_0_1px_var(--ld-accent-line)]'
                : 'text-ld-text-3 hover:text-ld-text-2'
            }`}
          >
            <Icon className="w-[13px] h-[13px]" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
