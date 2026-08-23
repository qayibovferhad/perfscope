import { useEffect, useState } from 'react';

/**
 * Whether a CSS media query currently matches, as state.
 *
 * For the handful of places where a breakpoint has to change a *number* rather than a
 * class — the waterfall's name column is an inline pixel width shared with the flame chart
 * below it, and the two have to agree or the x-axes stop lining up. Everything that can be
 * expressed as a Tailwind variant should stay a Tailwind variant.
 *
 * Reads on mount rather than during render: a value read at module scope is wrong the
 * moment the window is resized, and reading during render makes the first paint disagree
 * with the second.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
