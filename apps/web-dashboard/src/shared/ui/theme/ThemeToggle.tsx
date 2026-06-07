import { Sun, Moon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useTheme } from './ThemeProvider';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'w-[38px] h-[38px] rounded-[10px] grid place-items-center border border-ld-border-strong bg-ld-surface text-ld-text-2 cursor-pointer transition-all duration-200 hover:text-ld-text hover:border-ld-accent-line',
        className,
      )}
    >
      {theme === 'dark'
        ? <Sun  className="w-[17px] h-[17px]" />
        : <Moon className="w-[17px] h-[17px]" />}
    </button>
  );
}
