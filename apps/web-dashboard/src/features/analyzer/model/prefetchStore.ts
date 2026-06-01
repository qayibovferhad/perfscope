import { create } from 'zustand';
import { startAnalysis } from '@/shared/api/socket';
import type { AnalysisResult, AnalysisProgress, CategoryPartial, AnalysisCategory } from '@/entities/analysis';

export type PrefetchPartialMap = Partial<Record<AnalysisCategory, CategoryPartial>>;

type Status = 'idle' | 'loading' | 'success' | 'error';

interface PrefetchStore {
  url:      string | null;
  status:   Status;
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

    const cleanup = startAnalysis(url, {
      onProgress: (progress) => set({ progress }),
      onPartial:  (partial)  => set((s) => ({
        partials: { ...s.partials, [partial.category]: partial },
      })),
      onComplete: (result)   => set({ status: 'success', result, progress: null }),
      onError:    ()         => set({ status: 'error', progress: null }),
    });

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
