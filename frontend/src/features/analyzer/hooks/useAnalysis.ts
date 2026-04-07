import { useState, useCallback, useRef } from 'react';
import { startAnalysis } from '@/api/socket';
import type { AnalysisResult, AnalysisProgress, CategoryPartial, AnalysisCategory } from '../types';

type Status = 'idle' | 'loading' | 'success' | 'error';

export type PartialMap = Partial<Record<AnalysisCategory, CategoryPartial>>;

interface State {
  status: Status;
  progress: AnalysisProgress | null;
  partials: PartialMap;
  data: AnalysisResult | null;
  error: string | null;
}

const INITIAL: State = { status: 'idle', progress: null, partials: {}, data: null, error: null };

export function useAnalysis() {
  const [state, setState] = useState<State>(INITIAL);
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

      onComplete: (data) =>
        setState({ status: 'success', data, progress: null, partials: {}, error: null }),

      onError: (error) =>
        setState({ status: 'error', error, data: null, progress: null, partials: {} }),
    });

    cleanupRef.current = cleanup;
  }, []);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setState(INITIAL);
  }, []);

  return {
    analyze,
    reset,
    data:      state.data,
    progress:  state.progress,
    partials:  state.partials,
    isPending: state.status === 'loading',
    isError:   state.status === 'error',
    isSuccess: state.status === 'success',
    error:     state.error,
  };
}
