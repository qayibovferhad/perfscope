import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuditFormFactor } from '@perfscope/shared';
import type { AuditPrecision } from '@perfscope/shared';

/**
 * The user's chosen device profile, persisted across sessions. Every entry point
 * that starts an audit (analyzer form, deep links, website-card prefetch) reads
 * it, so picking Mobile once makes all subsequent audits mobile until changed.
 */
interface AuditModeStore {
  formFactor:    AuditFormFactor;
  setFormFactor: (f: AuditFormFactor) => void;
  precision:     AuditPrecision;
  setPrecision:  (p: AuditPrecision) => void;
  /**
   * Whether a report shows how it moved since the previous run of the same page.
   *
   * A reading preference, not an audit setting: the comparison is computed server-side and
   * stored on the result either way, so this only decides whether the report is read as
   * "where this page stands" or as "what changed". Kept beside the other two because it
   * belongs to the same question — how the user wants their audits presented — and because
   * a preference that resets every session is one nobody bothers to set.
   */
  compareWithPrevious:    boolean;
  setCompareWithPrevious: (on: boolean) => void;
}

export const useAuditModeStore = create<AuditModeStore>()(
  persist(
    (set) => ({
      formFactor:    'desktop',
      setFormFactor: (formFactor) => set({ formFactor }),
      precision:     'single',
      setPrecision:  (precision) => set({ precision }),
      // Off by default, at the user's request: a report should first say where the page
      // stands, and only say what changed when someone asks it to. The switch sits beside
      // the scores where the arrows would appear, so asking is one click.
      compareWithPrevious:    false,
      setCompareWithPrevious: (compareWithPrevious) => set({ compareWithPrevious }),
    }),
    { name: 'perfscope-audit-mode' },
  ),
);
