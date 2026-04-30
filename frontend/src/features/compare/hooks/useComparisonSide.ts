import { useState, useCallback, useRef } from 'react';
import { startCompareAnalysis } from '../api/compareSocket';
import type { AnalysisResult, AnalysisProgress } from '../../analyzer/types';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface State {
  status:   Status;
  data:     AnalysisResult | null;
  progress: AnalysisProgress | null;
  error:    string | null;
}

const INITIAL: State = { status: 'idle', data: null, progress: null, error: null };

export function useComparisonSide() {
  const [state, setState] = useState<State>(INITIAL);
  const cleanupRef = useRef<(() => void) | null>(null);

  const analyze = useCallback((url: string) => {
    cleanupRef.current?.();
    setState({ status: 'loading', data: null, progress: null, error: null });

    const cleanup = startCompareAnalysis(url, {
      onProgress: (progress) =>
        setState((prev) => ({ ...prev, progress })),

      onPartial: () => {},

      onComplete: (data) =>
        setState({ status: 'success', data, progress: null, error: null }),

      onError: (error) =>
        setState({ status: 'error', error, data: null, progress: null }),
    });

    cleanupRef.current = cleanup;
  }, []);

  const setData = useCallback((data: AnalysisResult) => {
    cleanupRef.current?.();
    setState({ status: 'success', data, progress: null, error: null });
  }, []);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setState(INITIAL);
  }, []);

  return {
    analyze,
    setData,
    reset,
    data:      state.data,
    progress:  state.progress,
    isIdle:    state.status === 'idle',
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError:   state.status === 'error',
    error:     state.error,
  };
}
