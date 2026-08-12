import { cn } from '@/shared/lib/utils';

interface Props {
  children: React.ReactNode;
  className?: string;
  /** `sunken` is the inner box that sits INSIDE a panel — surface-2, tighter radius. */
  tone?: 'default' | 'sunken';
  border?: 'default' | 'strong';
}

export function Panel({ children, className, tone = 'default', border = 'default' }: Props) {
  return (
    <div
      className={cn(
        'border overflow-hidden',
        tone === 'sunken' ? 'rounded-[13px] bg-ld-surface-2' : 'rounded-[16px] bg-ld-surface',
        border === 'strong' ? 'border-ld-border-strong' : 'border-ld-border',
        className,
      )}
    >
      {children}
    </div>
  );
}
