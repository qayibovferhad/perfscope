import { useState, useCallback, useRef } from 'react';
import type { AsyncStatus } from '@/shared/lib/types';
import { startCompareAnalysis, startCompareAuthAudit } from '../api/compareSocket';
import type { AnalysisResult, AnalysisProgress } from '@/entities/analysis';


interface State {
  status:   AsyncStatus;
  data:     AnalysisResult | null;
  progress: AnalysisProgress | null;
  error:    string | null;
}

const INITIAL: State = { status: 'idle', data: null, progress: null, error: null };

export function useComparisonSide() {
  const [state, setState] = useState<State>(INITIAL);
  const cleanupRef = useRef<(() => void) | null>(null);

  const callbacks = {
    onProgress: (progress: AnalysisProgress) => setState((prev) => ({ ...prev, progress })),
    onPartial:  () => {},
    onComplete: (data: AnalysisResult)        => setState({ status: 'success', data, progress: null, error: null }),
    onError:    (error: string)               => setState({ status: 'error', error, data: null, progress: null }),
  };

  const analyze = useCallback((url: string) => {
    cleanupRef.current?.();
    setState({ status: 'loading', data: null, progress: null, error: null });
    cleanupRef.current = startCompareAnalysis(url, callbacks);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startAuthAudit = useCallback((sessionId: string, url: string) => {
    cleanupRef.current?.();
    setState({ status: 'loading', data: null, progress: null, error: null });
    cleanupRef.current = startCompareAuthAudit(sessionId, url, callbacks);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    startAuthAudit,
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
