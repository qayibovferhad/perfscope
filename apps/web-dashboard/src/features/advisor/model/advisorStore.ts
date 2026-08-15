import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdvisorState {
  /** Persisted, because a panel that reopens itself on every navigation is an annoyance. */
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

/**
 * Open by default only where the panel is free.
 *
 * At 1536px and up it occupies space the layout was not using — `<Page>` caps content at
 * 1180px — so being open costs the page nothing. Below that it overlays, and landing on a
 * laptop with something covering the right-hand third is not a good first impression. One
 * click either way, and the choice sticks from then on.
 */
const ROOMY = '(min-width: 1536px)';

export const useAdvisorStore = create<AdvisorState>()(
  persist(
    (set) => ({
      open: typeof window !== 'undefined' && window.matchMedia?.(ROOMY).matches,
      toggle:  () => set((s) => ({ open: !s.open })),
      setOpen: (open) => set({ open }),
    }),
    { name: 'perfscope-advisor' },
  ),
);
