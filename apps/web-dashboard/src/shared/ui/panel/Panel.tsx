import { cn } from '@/shared/lib/utils';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** `sunken` is the inner box that sits INSIDE a panel — surface-2, tighter radius. */
  tone?: 'default' | 'sunken';
  border?: 'default' | 'strong';
}

// `rest` is forwarded so a caller can put an id, a `data-*` or an aria attribute on the
// panel — `data-print="hide"` was silently dropped before this, which is a failure mode
// with no symptom: the attribute is simply absent and nothing complains.
export function Panel({ children, className, tone = 'default', border = 'default', ...rest }: Props) {
  return (
    <div
      {...rest}
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
