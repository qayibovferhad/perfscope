import { useState, useCallback, useRef } from 'react';
import type { AsyncStatus } from '@/shared/lib/types';
import { startCompareAnalysis, startCompareAuthAudit } from '../api/compareSocket';
import type { AuditFormFactor } from '@perfscope/shared';
import type { AuditPrecision } from '@/entities/analysis';
import { mergeAnalysisInsights } from '@/entities/analysis';
import type { AnalysisResult, AnalysisProgress, AnalysisInsightsPayload, CategoryPartial, PartialMap } from '@/entities/analysis';

/**
 * Where `data` came from — 'live' is a real socket run, backed by a `History` row a
 * question can be asked against; 'external' is an uploaded JSON file or a preloaded pair
 * (`consumeComparePreload`), which may carry an id with no corresponding row this user
 * owns. Ask-about-audit gates on this so it never targets an id that isn't really theirs.
 */
export type ComparisonSideOrigin = 'live' | 'external';

interface State {
  status:   AsyncStatus;
  data:     AnalysisResult | null;
  progress: AnalysisProgress | null;
  partials: PartialMap;
  error:    string | null;
  origin:   ComparisonSideOrigin | null;
}

const INITIAL: State = { status: 'idle', data: null, progress: null, partials: {}, error: null, origin: null };

export function useComparisonSide() {
  const [state, setState] = useState<State>(INITIAL);
  const cleanupRef = useRef<(() => void) | null>(null);

  const callbacks = {
    onProgress: (progress: AnalysisProgress) => setState((prev) => ({ ...prev, progress })),
    // Each category (performance+a11y, seo+best-practices) finishes on its own worker
    // thread and reports in independently — same signal the analyzer's own hook uses to
    // paint scores before the full audit (and the other side of this comparison) is done.
    onPartial: (partial: CategoryPartial) => setState((prev) => ({
      ...prev,
      partials: { ...prev.partials, [partial.category]: partial },
    })),
    onComplete: (data: AnalysisResult) =>
      setState({ status: 'success', data, progress: null, partials: {}, error: null, origin: 'live' }),
    // Gemini's commentary, arriving after onComplete — same merge the analyzer's own
    // socket hook uses. Without this, `data.aiInsights` never lands on a compare side.
    onInsights: (payload: AnalysisInsightsPayload) =>
      setState((prev) =>
        prev.data && prev.data.id === payload.analysisId
          ? { ...prev, data: mergeAnalysisInsights(prev.data, payload) }
          : prev),
    onError:    (error: string) => setState({ status: 'error', error, data: null, progress: null, partials: {}, origin: null }),
  };

  const analyze = useCallback((url: string, formFactor?: AuditFormFactor, precision?: AuditPrecision) => {
    cleanupRef.current?.();
    setState({ status: 'loading', data: null, progress: null, partials: {}, error: null, origin: null });
    cleanupRef.current = startCompareAnalysis(url, callbacks, formFactor, precision);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startAuthAudit = useCallback((sessionId: string, url: string, formFactor?: AuditFormFactor) => {
    cleanupRef.current?.();
    setState({ status: 'loading', data: null, progress: null, partials: {}, error: null, origin: null });
    cleanupRef.current = startCompareAuthAudit(sessionId, url, callbacks, formFactor);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setData = useCallback((data: AnalysisResult) => {
    cleanupRef.current?.();
    setState({ status: 'success', data, progress: null, partials: {}, error: null, origin: 'external' });
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
    partials:  state.partials,
    origin:    state.origin,
    isIdle:    state.status === 'idle',
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError:   state.status === 'error',
    error:     state.error,
  };
}
