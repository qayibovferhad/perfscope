import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${className}`}
      style={{
        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        border:     isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = isDark
          ? 'rgba(255,255,255,0.12)'
          : 'rgba(0,0,0,0.10)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = isDark
          ? 'rgba(255,255,255,0.06)'
          : 'rgba(0,0,0,0.06)';
      }}
    >
      {isDark
        ? <Sun  className="w-3.5 h-3.5 text-amber-400" />
        : <Moon className="w-3.5 h-3.5 text-violet-500" />}
    </button>
  );
}
