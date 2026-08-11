export interface TabItem<T extends string> {
  key:    T;
  label:  string;
  icon?:  React.ReactNode;
  /** A count beside the label — "Audits · 12". Hidden when undefined. */
  badge?: React.ReactNode;
}

interface Props<T extends string> {
  tabs:      TabItem<T>[];
  active:    T;
  onChange:  (key: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * The pill tab strip.
 *
 * Shared rather than owned by one page: history had the only copy, and the project detail
 * page needs the same control. Two implementations of a tab strip drift in padding and
 * active-state colour the first time either is touched.
 */
export function TabBar<T extends string>({
  tabs, active, onChange, ariaLabel, className,
}: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex gap-[3px] p-[4px] rounded-[13px] border border-ld-border bg-ld-surface-2 ${className ?? ''}`}
    >
      {tabs.map(({ key, label, icon, badge }) => {
        const selected = active === key;
        return (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-[8px] text-[14px] font-medium px-[18px] py-[10px] rounded-[10px] border transition-all duration-200 ${
              selected
                ? 'bg-ld-accent-soft border-ld-accent-line text-ld-accent-2 font-semibold'
                : 'bg-transparent border-transparent text-ld-text-2 hover:text-ld-text'
            }`}
          >
            {icon}
            {label}
            {badge !== undefined && (
              <span className={`font-mono text-[12px] ${selected ? 'text-ld-accent' : 'text-ld-text-3'}`}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
