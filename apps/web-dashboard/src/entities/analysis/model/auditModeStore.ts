import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuditFormFactor } from '@perfscope/shared';

/**
 * The user's chosen device profile, persisted across sessions. Every entry point
 * that starts an audit (analyzer form, deep links, website-card prefetch) reads
 * it, so picking Mobile once makes all subsequent audits mobile until changed.
 */
interface AuditModeStore {
  formFactor:    AuditFormFactor;
  setFormFactor: (f: AuditFormFactor) => void;
}

export const useAuditModeStore = create<AuditModeStore>()(
  persist(
    (set) => ({
      formFactor:    'desktop',
      setFormFactor: (formFactor) => set({ formFactor }),
    }),
    { name: 'perfscope-audit-mode' },
  ),
);
