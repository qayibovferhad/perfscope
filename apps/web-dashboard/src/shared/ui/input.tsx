import * as React from 'react';
import { cn } from '@/shared/lib/utils';

interface InputProps extends React.ComponentProps<'input'> {
  icon?: React.ReactNode;
  error?: boolean;
  mono?: boolean;
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, mono, wrapperClassName, ...props }, ref) => {
    if (icon) {
      return (
        <div className={cn(
          'group flex items-center gap-[10px] px-[14px] rounded-[12px] border bg-ld-bg-2 transition-all duration-200',
          wrapperClassName,
          error
            ? 'border-ld-rose shadow-[0_0_0_4px_rgba(242,100,122,0.13)]'
            : 'border-ld-border-strong focus-within:border-ld-accent focus-within:shadow-[0_0_0_4px_var(--ld-accent-soft)]',
        )}>
          <span className={cn(
            'shrink-0 transition-colors duration-200 [&>svg]:w-[17px] [&>svg]:h-[17px]',
            error ? 'text-ld-rose' : 'text-ld-text-3 group-focus-within:text-ld-accent',
          )}>
            {icon}
          </span>
          <input
            ref={ref}
            className={cn(
              'flex-1 bg-transparent border-none outline-none text-ld-text text-[14.5px] py-3 min-w-0 placeholder:text-ld-text-3',
              mono && 'font-mono',
              className,
            )}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-[12px] border border-ld-border-strong bg-ld-bg-2 px-[14px] py-3 text-[14.5px] text-ld-text placeholder:text-ld-text-3 outline-none transition-all duration-200',
          'focus:border-ld-accent focus:shadow-[0_0_0_4px_var(--ld-accent-soft)]',
          error && 'border-ld-rose shadow-[0_0_0_4px_rgba(242,100,122,0.13)]',
          mono && 'font-mono',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
