import { cn } from '@/shared/lib/utils';

interface PanelHeaderProps {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PanelHeader({ icon, title, meta, children, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center gap-[10px] px-[18px] py-[14px] border-b border-ld-border', className)}>
      <span className="w-[32px] h-[32px] rounded-[9px] grid place-items-center bg-ld-accent-soft border border-ld-accent-line [&_svg]:w-[15px] [&_svg]:h-[15px] [&_svg]:text-[var(--ld-accent)] shrink-0">
        {icon}
      </span>
      <span className="text-[14px] font-bold text-ld-text tracking-tight flex-1">{title}</span>
      {meta && (
        <span className="font-mono text-[11px] text-ld-text-3 tabular-nums">{meta}</span>
      )}
      {children}
    </div>
  );
}
