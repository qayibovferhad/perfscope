import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * StatusPill — small rounded badge with tone-based colour.
 * Use for connection status, env/build tags, audit categories, etc.
 */
const statusPillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium border whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-white/[0.04]      border-white/[0.08]    text-ps-secondary',
        accent:  'bg-ps-accent-muted   border-ps-accent-border  text-ps-accent',
        success: 'bg-ps-healthy-muted  border-ps-healthy-border text-ps-healthy',
        warning: 'bg-ps-amber-muted    border-ps-amber-border   text-ps-amber',
        danger:  'bg-ps-reg-muted      border-ps-reg-border     text-ps-regression',
      },
      size: {
        sm: 'px-2  py-0.5 text-[10px]',
        md: 'px-3  py-1.5 text-xs',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
    },
  },
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {}

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, tone, size, ...props }, ref) => (
    <span ref={ref} className={cn(statusPillVariants({ tone, size }), className)} {...props} />
  ),
);
StatusPill.displayName = 'StatusPill';
