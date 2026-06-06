import { cn } from '@/shared/lib/utils';

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[16px] border border-ld-border bg-ld-surface overflow-hidden', className)}>
      {children}
    </div>
  );
}
