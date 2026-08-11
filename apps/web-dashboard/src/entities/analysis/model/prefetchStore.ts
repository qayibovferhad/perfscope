import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/types';
import { startAnalysis } from '../api/analysisSocket';
import { useAuditModeStore } from './auditModeStore';
import type { AnalysisResult, AnalysisProgress, CategoryPartial, AnalysisCategory } from '@perfscope/shared';

export type PrefetchPartialMap = Partial<Record<AnalysisCategory, CategoryPartial>>;


interface PrefetchStore {
  url:      string | null;
  status:   AsyncStatus;
  result:   AnalysisResult | null;
  partials: PrefetchPartialMap;
  progress: AnalysisProgress | null;

  start:  (url: string) => void;
  cancel: () => void;
  clear:  () => void;

  _cleanup: (() => void) | null;
}

export const usePrefetchStore = create<PrefetchStore>((set, get) => ({
  url:      null,
  status:   'idle',
  result:   null,
  partials: {},
  progress: null,
  _cleanup: null,

  start(url: string) {
    get()._cleanup?.();

    set({ url, status: 'loading', result: null, partials: {}, progress: null });

    // Honor the persisted device profile — a website-card "Analyze" click must
    // run in the same mode the analyzer toggle shows.
    const { formFactor, precision } = useAuditModeStore.getState();

    const cleanup = startAnalysis(url, {
      onProgress: (progress) => set({ progress }),
      onPartial:  (partial)  => set((s) => ({
        partials: { ...s.partials, [partial.category]: partial },
      })),
      onComplete: (result)   => set({ status: 'success', result, progress: null }),
      onError:    ()         => set({ status: 'error', progress: null }),
    }, { formFactor, precision });

    set({ _cleanup: cleanup });
  },

  cancel() {
    get()._cleanup?.();
    set({ url: null, status: 'idle', result: null, partials: {}, progress: null, _cleanup: null });
  },

  clear() {
    get()._cleanup?.();
    set({ url: null, status: 'idle', result: null, partials: {}, progress: null, _cleanup: null });
  },
}));
