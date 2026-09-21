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
 * Open by default only where the panel is genuinely free.
 *
 * It used to be 1536px, on the reasoning that `<Page>` caps content at 1180 — but the
 * sidebar is 288 and the open panel is 300, so at exactly 1536 the column was squeezed to
 * 938px: *narrower* than the same page on a 1440px laptop. Crossing a breakpoint must not
 * make the content smaller.
 *
 * 1800px is where all three fit at full width (288 + 1320 + 300 = 1908 at 1920, and the
 * column simply gives a little back between the two). Below that the panel still opens on
 * one click, over the page, and the choice sticks from then on.
 */
const ROOMY = '(min-width: 1800px)';

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
