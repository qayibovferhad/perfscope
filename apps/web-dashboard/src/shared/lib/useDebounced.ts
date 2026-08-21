import { useEffect, useState } from 'react';

/**
 * The value, trailing its source by `delayMs` — for search inputs whose queries
 * shouldn't fire per keystroke. Two pages carried this identical setTimeout pair.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
