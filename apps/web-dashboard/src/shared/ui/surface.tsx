import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

/**
 * Surface — the canonical panel primitive.
 * Replaces ad-hoc inline-styled panel divs — tones are built on the --ld-* tokens.
 *
 * Tones map to the semantic colour families in the design system. Use `padding` instead
 * of writing `p-5` on the consumer side so spacing stays consistent across the app.
 */
const surfaceVariants = cva(
  'rounded-2xl border backdrop-blur-md transition-colors',
  {
    variants: {
      tone: {
        default: 'bg-ps-surface border-ps-surface-border',
        accent:  'bg-ps-accent-muted border-ps-accent-border',
        amber:   'bg-ps-amber-muted border-ps-amber-border',
        healthy: 'bg-ps-healthy-muted border-ps-healthy-border',
        danger:  'bg-ps-reg-muted border-ps-reg-border',
      },
      padding: {
        none: 'p-0',
        sm:   'p-3',
        md:   'p-5',
        lg:   'p-6',
      },
    },
    defaultVariants: {
      tone:    'default',
      padding: 'md',
    },
  },
);

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surfaceVariants> {}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, tone, padding, ...props }, ref) => (
    <div ref={ref} className={cn(surfaceVariants({ tone, padding }), className)} {...props} />
  ),
);
Surface.displayName = 'Surface';
