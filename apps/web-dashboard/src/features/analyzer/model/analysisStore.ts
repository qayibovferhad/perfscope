import { create } from 'zustand';
import { hmrSingleton } from '@/shared/lib/hmrSingleton';
import type { AnalysisResult } from '@/entities/analysis';

interface AnalysisStore {
  lastResult: AnalysisResult | null;
  lastUrl:    string;
  /**
   * How long the run that produced `lastResult` took, in ms.
   *
   * Kept beside the result rather than inside it: this is what the clock on screen
   * counted, not something the server reported, so a stored audit reopened from history
   * has no duration and must show none rather than borrow this one.
   */
  lastDurationMs: number | null;
  /**
   * `durationMs` omitted means "leave it alone", explicit `null` means "this result has
   * none". Gemini's commentary lands seconds after the scores and re-saves the result;
   * without that distinction the duration would be wiped by the AI arriving.
   */
  setResult:  (data: AnalysisResult, url: string, durationMs?: number | null) => void;
  clear:      () => void;
}

/** Per tab — the shell writes a finished result into this and the analyzer reads it; two
 *  copies after a hot reload means one of them is talking to itself. */
export const useAnalysisStore = hmrSingleton('analysisResult', () => create<AnalysisStore>((set) => ({
  lastResult: null,
  lastUrl:    '',
  lastDurationMs: null,
  setResult:  (data, url, durationMs) => set((s) => ({
    lastResult: data,
    lastUrl:    url,
    lastDurationMs: durationMs === undefined ? s.lastDurationMs : durationMs,
  })),
  clear:      ()          => set({ lastResult: null, lastUrl: '', lastDurationMs: null }),
})));
