import { create } from 'zustand';
import { hmrSingleton } from '@/shared/lib/hmrSingleton';

interface PaletteStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/**
 * Whether the palette is showing.
 *
 * In `shared` because the two halves live in different widgets and a widget may not
 * import another: the palette renders itself, and the sidebar advertises it. A store
 * rather than local state so anything can open it — the shortcut, that button, an empty
 * state offering "press ⌘K". One per tab, because two copies would be one listening for
 * the key and another rendering.
 */
export const usePaletteStore = hmrSingleton('commandPalette', () => create<PaletteStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle:  ()     => set(s => ({ open: !s.open })),
})));

// See the note in runningAuditsStore: live state, so hot updates reload instead.
if (import.meta.hot) import.meta.hot.accept(() => import.meta.hot?.invalidate());
