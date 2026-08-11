import { cn } from '@/shared/lib/utils';

/**
 * The padded region below a PanelHeader.
 *
 * `Panel` deliberately has no padding of its own — some panels need their content to run
 * edge to edge (tables, full-bleed charts). That left every consumer hand-rolling the
 * same `px-[18px] py-[16px]`, and any that forgot ended up with content welded to the
 * border. This is that wrapper, named, so forgetting it is visible in the markup.
 */
export function PanelBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-[18px] py-[16px]', className)}>{children}</div>;
}
