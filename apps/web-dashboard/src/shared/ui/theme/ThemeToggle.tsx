import { Sun, Moon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useTheme } from './ThemeProvider';

const OPTIONS = [
  { value: 'dark'  as const, Icon: Moon, label: 'Dark'  },
  { value: 'light' as const, Icon: Sun,  label: 'Light' },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <div className={cn('inline-flex p-[3px] rounded-[10px] border border-ld-border bg-ld-surface-2', className)}>
      {OPTIONS.map(({ value, Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            onClick={() => { if (theme !== value) toggle(); }}
            aria-label={`Switch to ${label} mode`}
            className={`inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-[7px] text-[12px] font-medium transition-all duration-200 ${
              active
                ? 'bg-ld-surface border border-ld-border text-ld-text'
                : 'text-ld-text-3 hover:text-ld-text-2 border border-transparent'
            }`}
          >
            <Icon className="w-[13px] h-[13px]" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
