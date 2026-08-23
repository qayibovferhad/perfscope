import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AsyncStatus } from '@/shared/lib/types';
import { startAnalysis, joinAnalysis, emitAuthAuditStart, mergeAnalysisInsights, cancelAnalysis, type AuditPrecision } from '@/entities/analysis';
import { useAnalysisStore } from './analysisStore';
import { useRunningAuditsStore } from '@/entities/analysis';
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

  /**
   * Set by an explicit Stop, cleared only by an explicit start.
   *
   * Stopping is a strong instruction and nothing should quietly undo it — not the shell's
   * pill, not an adopt on arrival, not a stale run left in a store. Whatever else is going
   * on, after Stop this page stays stopped until the person asks for another audit.
   */
  const stoppedByUser = useRef(false);

  const analyze = useCallback((url: string, projectId?: string, formFactor?: AuditFormFactor, precision?: AuditPrecision) => {
    stoppedByUser.current = false;
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
        // Announcing a finished run is the shell's job, not this page's — see
        // `useFinishedAuditToast`. It has to work when this page is *not* mounted, which is
        // exactly the case a listener living here cannot cover.
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
    stoppedByUser.current = false;
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
    // Refused after an explicit Stop: re-attaching to a run the user just stopped is how a
    // stopped audit comes back to life on screen, clock and all.
    if (stoppedByUser.current) return;
    cleanupRef.current?.();
    // The clock is the run's, not this page's. Adopting used to show no elapsed time at all
    // — the run began before the page did, and counting from the mount would have been a
    // wrong number rather than a missing one. The shell's running-audits store knows when
    // it actually started, so the honest number is available now and the clock is right
    // even though it is being watched from its second minute.
    const running = useRunningAuditsStore.getState().runs.find(r => r.returnTo === '/app');
    // The id comes from the store too, and not only for tidiness: `cancel` needs it, and
    // the page otherwise learns it from the *next* progress event — which in Fast mode can
    // be twenty seconds away. Stop pressed in that window reset the page and left the audit
    // running, which is exactly what it looks like: the shell's pill kept counting.
    setState({
      status: 'loading', progress: null, partials: {}, data: null, error: null, errorCode: null,
      aiPending: false,
      analysisId: running?.analysisId ?? null,
      startedAt:  running?.startedAt ?? null,
    });
    const cleanup = joinAnalysis({
      onProgress: (progress) => setState((prev) => ({ ...prev, progress, analysisId: progress.analysisId || prev.analysisId })),
      onPartial:  (partial)  => setState((prev) => ({
        ...prev,
        partials: { ...prev.partials, [partial.category]: partial },
      })),
      onComplete: (data) => {
        const startedAt = stateRef.current.startedAt;
        setState({ status: 'success', data, progress: null, partials: {}, error: null, errorCode: null, aiPending: true, analysisId: null, startedAt: null });
        // A duration now, when the adopted run's real start time was known (see above).
        setResult(data, data.url, startedAt ? Date.now() - startedAt : null);
        startAiWait();
      },
      onInsights: applyInsights,
      onError: (error, code) =>
        setState({ status: 'error', error, errorCode: code ?? null, data: null, progress: null, partials: {}, aiPending: false, analysisId: null, startedAt: null }),
    });
    cleanupRef.current = cleanup;
  }, [setResult, applyInsights, startAiWait]);

  const startAuthAudit = useCallback((sessionId: string, url: string, formFactor?: AuditFormFactor) => {
    stoppedByUser.current = false;
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
    // The shell's record is the fallback, for the same reason `adoptRunning` reads it: this
    // page only learns the id from a progress event, so Stop pressed in the first seconds of
    // a run — or straight after adopting one — had nothing to send and quietly did nothing
    // but reset the form. The audit carried on, and the pill was the only thing that said so.
    const analysisId = stateRef.current.analysisId
      ?? useRunningAuditsStore.getState().runs.find(r => r.returnTo === '/app')?.analysisId
      ?? null;
    stoppedByUser.current = true;
    cleanupRef.current?.();
    cleanupRef.current = null;
    stopAiWait();
    // Sent even when it is null: the server resolves that against this socket's own
    // in-flight run. Skipping the emit is what made Stop do nothing in the first seconds.
    cancelAnalysis(analysisId);
    // Every run this page could adopt goes, not just the one it happened to know the id
    // of. A leftover entry is a pill that keeps counting and an adopt waiting to happen.
    for (const run of useRunningAuditsStore.getState().runs) {
      if (run.returnTo === '/app') useRunningAuditsStore.getState().end(run.key);
    }
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

// ─── Dev only ────────────────────────────────────────────────────────────────
// This module holds live state — a socket, a store, or the listeners that keep them in
// step. Vite's default hot update evaluates a *new copy* and leaves the old one running,
// so the tab ends up with two of everything: one set answering events, another rendering
// the screen. That is invisible until something like Stop stops working, and then it
// costs hours, because a fresh tab behaves perfectly and the reporter's does not.
//
// So changes here force a full reload instead. Slower to develop against, and honest.
if (import.meta.hot) import.meta.hot.accept(() => import.meta.hot?.invalidate());
