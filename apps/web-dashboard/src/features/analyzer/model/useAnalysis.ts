import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AsyncStatus } from '@/shared/lib/types';
import { startAnalysis, joinAnalysis, emitAuthAuditStart, mergeAnalysisInsights, cancelAnalysis, type AuditPrecision } from '@/entities/analysis';
import { useAnalysisStore } from './analysisStore';
import { toast } from '@/shared/ui/toast';
// The host alone — a toast has one line, and the scheme and path spend it saying nothing.
import { getHostname } from '@/entities/website';
import type { AnalysisResult, AnalysisProgress, AuditFormFactor, PartialMap } from '@/entities/analysis';
import type { AnalysisInsightsPayload } from '@perfscope/shared';

export type { PartialMap } from '@/entities/analysis';

interface State {
  status:   AsyncStatus;
  progress: AnalysisProgress | null;
  partials: PartialMap;
  data:     AnalysisResult | null;
  error:    string | null;
  /** Set when the failure has a repair the UI can offer — see SESSION_EXPIRED. */
  errorCode: string | null;
  /**
   * The scores are in and Gemini is still writing.
   *
   * The server emits `analysis:insights` for every live audit, even when it has nothing to
   * say, so this is answered by an event rather than guessed at — which is what lets the AI
   * surfaces show a skeleton instead of appearing from nowhere seconds after the report.
   * Only a live run sets it: `bootstrap` renders a stored result whose AI is already in it.
   */
  aiPending: boolean;
  /**
   * The id the server generated for the run in flight, learned from its first progress
   * event. Without it there is nothing to cancel: the audit belongs to the server, and
   * closing the tab only stops the watching, not the work.
   */
  analysisId: string | null;
  /** When the run started, for the elapsed clock. Null whenever nothing is running. */
  startedAt: number | null;
}

/**
 * How long to keep the skeletons up if `analysis:insights` never arrives.
 *
 * It always should — but a dropped socket between the two events would otherwise leave
 * placeholders on screen for the rest of the session.
 */
const AI_WAIT_TIMEOUT_MS = 30_000;

export function useAnalysis() {
  const { lastResult, lastUrl, lastDurationMs, setResult } = useAnalysisStore();
  const queryClient = useQueryClient();

  const [state, setState] = useState<State>(() => ({
    status:   lastResult ? 'success' : 'idle',
    progress: null,
    partials: {},
    data:      lastResult,
    error:     null,
    errorCode: null,
    aiPending: false,
    analysisId: null,
    startedAt:  null,
  }));

  const cleanupRef = useRef<(() => void) | null>(null);
  /**
   * Latest state, for callbacks that fire from socket events rather than from React.
   * Synced in an effect rather than during render — one commit behind is harmless here,
   * because the only reader is an event that arrives seconds after the commit it needs.
   */
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAiWait = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = null;
  }, []);

  /** Arm the skeletons, with a deadline so they cannot outlive the audit that raised them. */
  const startAiWait = useCallback(() => {
    stopAiWait();
    aiTimerRef.current = setTimeout(() => {
      aiTimerRef.current = null;
      setState((prev) => (prev.aiPending ? { ...prev, aiPending: false } : prev));
    }, AI_WAIT_TIMEOUT_MS);
  }, [stopAiWait]);

  useEffect(() => stopAiWait, [stopAiWait]);

  // Gemini's commentary arrives after the scores. Merge it into the result on screen rather
  // than replacing it — and only if it is still the same analysis; a user who started a new
  // audit in the meantime must not see the old page's advice land on the new numbers.
  const applyInsights = useCallback((data: AnalysisInsightsPayload) => {
    stopAiWait();

    // Read through a ref rather than a setState updater. This runs from a socket event, so
    // the ref is current — and writing to the Zustand store from inside an updater means
    // touching another component's state *during render*, which React logs as an error and
    // StrictMode runs twice.
    const prev = stateRef.current;
    if (!prev.data || prev.data.id !== data.analysisId) return;

    const next = mergeAnalysisInsights(prev.data, data);

    // aiPending drops here whether or not anything came back: an empty payload is the
    // server saying it has nothing to add, which is an answer, not a reason to keep waiting.
    setState((s) => ({ ...s, data: next, aiPending: false }));
    setResult(next, next.url);
  }, [setResult, stopAiWait]);

  const analyze = useCallback((url: string, projectId?: string, formFactor?: AuditFormFactor, precision?: AuditPrecision) => {
    cleanupRef.current?.();
    setState({ status: 'loading', progress: null, partials: {}, data: null, error: null, errorCode: null, aiPending: false, analysisId: null, startedAt: Date.now() });

    const cleanup = startAnalysis(url, {
      onProgress: (progress) =>
        setState((prev) => ({ ...prev, progress, analysisId: progress.analysisId || prev.analysisId })),

      onPartial: (partial) =>
        setState((prev) => ({
          ...prev,
          partials: { ...prev.partials, [partial.category]: partial },
        })),

      onComplete: (data) => {
        // Read the start off the previous state rather than the closure: `analyze` may have
        // been called again, and the run that just finished is the one that owns this clock.
        const startedAt = stateRef.current.startedAt;
        setState({ status: 'success', data, progress: null, partials: {}, error: null, errorCode: null, aiPending: true, analysisId: null, startedAt: null });
        setResult(data, url, startedAt ? Date.now() - startedAt : null);
        startAiWait();

        // Only when the reader has looked away. An audit takes tens of seconds, so people
        // switch tabs; announcing the result to someone who is watching the scores appear
        // in front of them is noise, and noise is how a notification system stops being read.
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          toast.success(`Audit finished — performance ${data.scores.performance}`, {
            description: getHostname(url),
          });
        }
      },
      onInsights: applyInsights,

      // Always announced: the analyzer shows the failure on screen, but a run started from
      // one page and abandoned for another would otherwise fail in silence.
      onError: (error, code) => {
        setState({ status: 'error', error, errorCode: code ?? null, data: null, progress: null, partials: {}, aiPending: false, analysisId: null, startedAt: null });
        toast.error('Audit failed', { description: `${getHostname(url)} — ${error}` });
      },
    }, { projectId, formFactor, precision });

    cleanupRef.current = cleanup;
  }, [setResult, applyInsights, startAiWait]);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setState({ status: 'idle', progress: null, partials: {}, data: null, error: null, errorCode: null, aiPending: false, analysisId: null, startedAt: null });
    stopAiWait();
    useAnalysisStore.getState().clear();
  }, [stopAiWait]);

  const bootstrap = useCallback((result: AnalysisResult, url: string) => {
    cleanupRef.current?.();
    stopAiWait();
    setState({ status: 'success', data: result, progress: null, partials: {}, error: null, errorCode: null, aiPending: false, analysisId: null, startedAt: null });
    setResult(result, url, null);
  }, [setResult, stopAiWait]);

  const adoptRunning = useCallback(() => {
    cleanupRef.current?.();
    // No startedAt: this attaches to a run that began before this page did, so the elapsed
    // clock would be counting from the wrong moment. Better no number than a wrong one.
    setState({ status: 'loading', progress: null, partials: {}, data: null, error: null, errorCode: null, aiPending: false, analysisId: null, startedAt: null });
    const cleanup = joinAnalysis({
      onProgress: (progress) => setState((prev) => ({ ...prev, progress, analysisId: progress.analysisId || prev.analysisId })),
      onPartial:  (partial)  => setState((prev) => ({
        ...prev,
        partials: { ...prev.partials, [partial.category]: partial },
      })),
      onComplete: (data) => {
        setState({ status: 'success', data, progress: null, partials: {}, error: null, errorCode: null, aiPending: true, analysisId: null, startedAt: null });
        // No duration: this run started before the page did (see adoptRunning above).
        setResult(data, data.url, null);
        startAiWait();
      },
      onInsights: applyInsights,
      onError: (error, code) =>
        setState({ status: 'error', error, errorCode: code ?? null, data: null, progress: null, partials: {}, aiPending: false, analysisId: null, startedAt: null }),
    });
    cleanupRef.current = cleanup;
  }, [setResult, applyInsights, startAiWait]);

  const startAuthAudit = useCallback((sessionId: string, url: string, formFactor?: AuditFormFactor) => {
    cleanupRef.current?.();
    setState({ status: 'loading', progress: null, partials: {}, data: null, error: null, errorCode: null, aiPending: false, analysisId: null, startedAt: Date.now() });

    const cleanup = emitAuthAuditStart(sessionId, url, {
      onProgress: (progress) => setState((prev) => ({ ...prev, progress, analysisId: progress.analysisId || prev.analysisId })),
      onPartial:  (partial)  => setState((prev) => ({
        ...prev,
        partials: { ...prev.partials, [partial.category]: partial },
      })),
      onComplete: (data) => {
        const startedAt = stateRef.current.startedAt;
        setState({ status: 'success', data, progress: null, partials: {}, error: null, errorCode: null, aiPending: true, analysisId: null, startedAt: null });
        setResult(data, url, startedAt ? Date.now() - startedAt : null);
        startAiWait();
        // The backend stores the freshly captured session on the website and clears its
        // login-wall flag, so the "Session expired" badge is stale the moment this lands.
        void queryClient.invalidateQueries({ queryKey: ['websites'] });
      },
      onInsights: applyInsights,
      onError: (error, code) =>
        setState({ status: 'error', error, errorCode: code ?? null, data: null, progress: null, partials: {}, aiPending: false, analysisId: null, startedAt: null }),
    }, formFactor);

    cleanupRef.current = cleanup;
  }, [setResult, queryClient, applyInsights, startAiWait]);

  /**
   * Stop the run in flight.
   *
   * Detaches first, then tells the server: killing the workers makes the audit throw, and
   * a listener still attached would turn the person's own decision into a red error panel.
   * Back to idle rather than to an error — nothing failed.
   */
  const cancel = useCallback(() => {
    const { analysisId } = stateRef.current;
    cleanupRef.current?.();
    cleanupRef.current = null;
    stopAiWait();
    if (analysisId) cancelAnalysis(analysisId);
    setState({ status: 'idle', progress: null, partials: {}, data: null, error: null, errorCode: null, aiPending: false, analysisId: null, startedAt: null });
  }, [stopAiWait]);

  return {
    analyze,
    cancel,
    reset,
    bootstrap,
    adoptRunning,
    startAuthAudit,
    lastUrl,
    startedAt: state.startedAt,
    /** How long the audit on screen took, when this session is the one that ran it. */
    durationMs: lastDurationMs,
    data:      state.data,
    progress:  state.progress,
    partials:  state.partials,
    isPending: state.status === 'loading',
    isError:   state.status === 'error',
    aiPending: state.aiPending,
    isSuccess: state.status === 'success',
    error:     state.error,
    errorCode: state.errorCode,
  };
}
