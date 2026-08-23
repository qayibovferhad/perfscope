import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeCtx = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {} });

const STORAGE_KEY = 'perfscope-theme';

/**
 * The theme to open with.
 *
 * Read lazily, in the initialiser, because the effect below *writes* to the same key: with
 * a hardcoded initial value the provider stored 'light' on every mount and overwrote
 * whatever the user had chosen, so the toggle worked for exactly as long as the tab stayed
 * open and every reload went back to light.
 *
 * With no stored choice, follow the OS rather than assuming.
 */
function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.removeAttribute('data-theme');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  /**
   * Paper is white, and browsers drop background colours by default.
   *
   * Printing the dark theme therefore lands light text on an unpainted page — a sheet
   * that looks blank until you notice the faint outlines. Swapping to the light palette
   * for the duration of the print is the whole fix, and it reuses the theme the app
   * already ships rather than a second print-only set of colours to keep in step.
   *
   * Listening for the events rather than only doing this behind an Export button, because
   * Ctrl-P is how most people reach for a PDF.
   */
  useEffect(() => {
    const root = document.documentElement;
    // Both halves of the switch, because the palette is in two places: the `--ld-*` tokens
    // key off `data-theme`, while the older shadcn ones key off the `dark` class. Setting
    // only the first left legacy-token text light-on-light — invisible on the page.
    const before = () => {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    };
    const after = () => {
      if (theme !== 'dark') return;
      root.classList.add('dark');
      root.removeAttribute('data-theme');
    };

    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [theme]);

  function toggle() {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
