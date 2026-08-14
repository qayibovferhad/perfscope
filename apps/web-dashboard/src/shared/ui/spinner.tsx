import { cn } from '@/shared/lib/utils';

/**
 * The ring spinner used for "this panel is loading".
 *
 * Five copies of the same four classes had grown, at four different sizes. Distinct from
 * lucide's `Loader2`, which stays where it is: that one is an icon *inside* something — a
 * button mid-submit, a row mid-refresh — and is sized by its context.
 */
const SIZES = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-[28px] h-[28px]',
} as const;

export function Spinner({ size = 'md', className }: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'rounded-full border-2 border-ld-border-strong border-t-ld-accent animate-spin',
        SIZES[size],
        className,
      )}
    />
  );
}
