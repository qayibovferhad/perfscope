import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AsyncStatus } from '@/shared/lib/types';
import { startAnalysis, joinAnalysis, emitAuthAuditStart, type AuditPrecision } from '@/entities/analysis';
import { useAnalysisStore } from './analysisStore';
import type { AnalysisResult, AnalysisProgress, CategoryPartial, AnalysisCategory, AuditFormFactor } from '@/entities/analysis';


export type PartialMap = Partial<Record<AnalysisCategory, CategoryPartial>>;

interface State {
  status:   AsyncStatus;
  progress: AnalysisProgress | null;
  partials: PartialMap;
  data:     AnalysisResult | null;
  error:    string | null;
  /** Set when the failure has a repair the UI can offer — see SESSION_EXPIRED. */
  errorCode: string | null;
}

export function useAnalysis() {
  const { lastResult, lastUrl, setResult } = useAnalysisStore();
  const queryClient = useQueryClient();

  const [state, setState] = useState<State>(() => ({
    status:   lastResult ? 'success' : 'idle',
    progress: null,
    partials: {},
    data:      lastResult,
    error:     null,
    errorCode: null,
  }));

  const cleanupRef = useRef<(() => void) | null>(null);

  const analyze = useCallback((url: string, projectId?: string, formFactor?: AuditFormFactor, precision?: AuditPrecision) => {
    cleanupRef.current?.();
    setState({ status: 'loading', progress: null, partials: {}, data: null, error: null, errorCode: null });

    const cleanup = startAnalysis(url, {
      onProgress: (progress) =>
        setState((prev) => ({ ...prev, progress })),

      onPartial: (partial) =>
        setState((prev) => ({
          ...prev,
          partials: { ...prev.partials, [partial.category]: partial },
        })),

      onComplete: (data) => {
        setState({ status: 'success', data, progress: null, partials: {}, error: null, errorCode: null });
        setResult(data, url);
      },

      onError: (error, code) =>
        setState({ status: 'error', error, errorCode: code ?? null, data: null, progress: null, partials: {} }),
    }, { projectId, formFactor, precision });

    cleanupRef.current = cleanup;
  }, [setResult]);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setState({ status: 'idle', progress: null, partials: {}, data: null, error: null, errorCode: null });
    useAnalysisStore.getState().clear();
  }, []);

  const bootstrap = useCallback((result: AnalysisResult, url: string) => {
    cleanupRef.current?.();
    setState({ status: 'success', data: result, progress: null, partials: {}, error: null, errorCode: null });
    setResult(result, url);
  }, [setResult]);

  const adoptRunning = useCallback(() => {
    cleanupRef.current?.();
    setState({ status: 'loading', progress: null, partials: {}, data: null, error: null, errorCode: null });
    const cleanup = joinAnalysis({
      onProgress: (progress) => setState((prev) => ({ ...prev, progress })),
      onPartial:  (partial)  => setState((prev) => ({
        ...prev,
        partials: { ...prev.partials, [partial.category]: partial },
      })),
      onComplete: (data) => {
        setState({ status: 'success', data, progress: null, partials: {}, error: null, errorCode: null });
        setResult(data, data.url);
      },
      onError: (error, code) =>
        setState({ status: 'error', error, errorCode: code ?? null, data: null, progress: null, partials: {} }),
    });
    cleanupRef.current = cleanup;
  }, [setResult]);

  const startAuthAudit = useCallback((sessionId: string, url: string, formFactor?: AuditFormFactor) => {
    cleanupRef.current?.();
    setState({ status: 'loading', progress: null, partials: {}, data: null, error: null, errorCode: null });

    const cleanup = emitAuthAuditStart(sessionId, url, {
      onProgress: (progress) => setState((prev) => ({ ...prev, progress })),
      onPartial:  (partial)  => setState((prev) => ({
        ...prev,
        partials: { ...prev.partials, [partial.category]: partial },
      })),
      onComplete: (data) => {
        setState({ status: 'success', data, progress: null, partials: {}, error: null, errorCode: null });
        setResult(data, url);
        // The backend stores the freshly captured session on the website and clears its
        // login-wall flag, so the "Session expired" badge is stale the moment this lands.
        void queryClient.invalidateQueries({ queryKey: ['websites'] });
      },
      onError: (error, code) =>
        setState({ status: 'error', error, errorCode: code ?? null, data: null, progress: null, partials: {} }),
    }, formFactor);

    cleanupRef.current = cleanup;
  }, [setResult, queryClient]);

  return {
    analyze,
    reset,
    bootstrap,
    adoptRunning,
    startAuthAudit,
    lastUrl,
    data:      state.data,
    progress:  state.progress,
    partials:  state.partials,
    isPending: state.status === 'loading',
    isError:   state.status === 'error',
    isSuccess: state.status === 'success',
    error:     state.error,
    errorCode: state.errorCode,
  };
}
