import { useState, useCallback, useRef } from 'react';
import { startAnalysis } from '@/api/socket';
import type { AnalysisResult, AnalysisProgress } from '../types';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface State {
  status: Status;
  progress: AnalysisProgress | null;
  data: AnalysisResult | null;
  error: string | null;
}

const INITIAL: State = { status: 'idle', progress: null, data: null, error: null };

export function useAnalysis() {
  const [state, setState] = useState<State>(INITIAL);
  const cleanupRef = useRef<(() => void) | null>(null);

  const analyze = useCallback((url: string) => {
    cleanupRef.current?.();
    setState({ status: 'loading', progress: null, data: null, error: null });

    const cleanup = startAnalysis(url, {
      onProgress: (progress) => setState((prev) => ({ ...prev, progress })),
      onComplete: (data) => setState({ status: 'success', data, progress: null, error: null }),
      onError: (error) => setState({ status: 'error', error, data: null, progress: null }),
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
    data: state.data,
    progress: state.progress,
    isPending: state.status === 'loading',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
    error: state.error,
  };
}
