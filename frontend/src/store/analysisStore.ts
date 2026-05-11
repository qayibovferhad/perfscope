import { create } from 'zustand';
import type { AnalysisResult } from '@/features/analyzer/types';

interface AnalysisStore {
  lastResult: AnalysisResult | null;
  lastUrl:    string;
  setResult:  (data: AnalysisResult, url: string) => void;
  clear:      () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  lastResult: null,
  lastUrl:    '',
  setResult:  (data, url) => set({ lastResult: data, lastUrl: url }),
  clear:      ()          => set({ lastResult: null, lastUrl: '' }),
}));
