import { useState, useCallback, useRef } from 'react';
import { startAnalysis } from '@/api/socket';
import { useAnalysisStore } from '@/store/analysisStore';
import type { AnalysisResult, AnalysisProgress, CategoryPartial, AnalysisCategory } from '../types';

type Status = 'idle' | 'loading' | 'success' | 'error';

export type PartialMap = Partial<Record<AnalysisCategory, CategoryPartial>>;

interface State {
  status:   Status;
  progress: AnalysisProgress | null;
  partials: PartialMap;
  data:     AnalysisResult | null;
  error:    string | null;
}

export function useAnalysis() {
  const { lastResult, lastUrl, setResult } = useAnalysisStore();

  const [state, setState] = useState<State>(() => ({
    status:   lastResult ? 'success' : 'idle',
    progress: null,
    partials: {},
    data:     lastResult,
    error:    null,
  }));

  const cleanupRef = useRef<(() => void) | null>(null);

  const analyze = useCallback((url: string) => {
    cleanupRef.current?.();
    setState({ status: 'loading', progress: null, partials: {}, data: null, error: null });

    const cleanup = startAnalysis(url, {
      onProgress: (progress) =>
        setState((prev) => ({ ...prev, progress })),

      onPartial: (partial) =>
        setState((prev) => ({
          ...prev,
          partials: { ...prev.partials, [partial.category]: partial },
        })),

      onComplete: (data) => {
        setState({ status: 'success', data, progress: null, partials: {}, error: null });
        setResult(data, url);
      },

      onError: (error) =>
        setState({ status: 'error', error, data: null, progress: null, partials: {} }),
    });

    cleanupRef.current = cleanup;
  }, [setResult]);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setState({ status: 'idle', progress: null, partials: {}, data: null, error: null });
    useAnalysisStore.getState().clear();
  }, []);

  return {
    analyze,
    reset,
    lastUrl,
    data:      state.data,
    progress:  state.progress,
    partials:  state.partials,
    isPending: state.status === 'loading',
    isError:   state.status === 'error',
    isSuccess: state.status === 'success',
    error:     state.error,
  };
}
