import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

/**
 * GradientIcon — the brand-gradient tile used for PerfScope identity marks,
 * section headers, and hero icons. Replaces the inline
 * `style={{ background: 'linear-gradient(135deg,#4f46e5,#8B5CF6)' }}` pattern.
 */
const gradientIconVariants = cva(
  'inline-flex items-center justify-center font-black text-white shrink-0 bg-ps-brand shadow-glow-accent-lg',
  {
    variants: {
      size: {
        sm: 'w-6  h-6  rounded-lg  text-[9px]',
        md: 'w-10 h-10 rounded-xl  text-sm',
        lg: 'w-16 h-16 rounded-2xl text-xl',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface GradientIconProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof gradientIconVariants> {}

export const GradientIcon = React.forwardRef<HTMLDivElement, GradientIconProps>(
  ({ className, size, ...props }, ref) => (
    <div ref={ref} className={cn(gradientIconVariants({ size }), className)} {...props} />
  ),
);
GradientIcon.displayName = 'GradientIcon';
