import { cn } from '@/shared/lib/utils';

interface ChipProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ children, active, onClick, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-[10px] py-[4px] rounded-full text-[11.5px] font-semibold border transition-all duration-150 cursor-pointer',
        active
          ? 'bg-ld-accent-soft text-[var(--ld-accent)] border-ld-accent-line'
          : 'bg-transparent text-ld-text-3 border-ld-border hover:border-ld-accent-line hover:text-ld-text-2',
        className,
      )}
    >
      {children}
    </button>
  );
}
