import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** What the panel should currently be advising about. Null means the whole account. */
export interface AdviceContext {
  scope: 'site';
  url:   string;
  /** Shown in the panel so it is obvious what the advice is about. */
  label: string;
}

interface AdvisorState {
  /** Persisted, because a panel that reopens itself on every navigation is an annoyance. */
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;

  /**
   * Set by whichever page is on screen — see `useAdviceContext`.
   *
   * The panel lives in the shell and deliberately does not know the route table: a widget
   * that pattern-matches `/projects/:id` and then digs the URL out of that page's query
   * cache would be reaching down two layers. Pages name their own subject instead.
   */
  context: AdviceContext | null;
  setContext: (context: AdviceContext | null) => void;
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

      context: null,
      setContext: (context) => set({ context }),
    }),
    {
      name: 'perfscope-advisor',
      // Only the preference survives a reload. The context belongs to whatever page is
      // mounted; persisting it would advise about a site the user has navigated away from.
      partialize: (s) => ({ open: s.open }),
    },
  ),
);
