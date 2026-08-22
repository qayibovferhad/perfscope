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
      // On by default: a delta beside a number is the difference between a measurement and
      // a trend, and a feature nobody knows to switch on is a feature nobody has.
      compareWithPrevious:    true,
      setCompareWithPrevious: (compareWithPrevious) => set({ compareWithPrevious }),
    }),
    { name: 'perfscope-audit-mode' },
  ),
);
