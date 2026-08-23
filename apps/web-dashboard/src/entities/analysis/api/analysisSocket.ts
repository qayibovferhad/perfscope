import type {
  AnalysisProgress, AnalysisResult, CategoryPartial, AuditFormFactor,
  AuditPrecision, AnalysisErrorPayload, AnalysisInsightsPayload,
} from '@perfscope/shared';
import { getSocket, type AppSocket } from '@/shared/api/socket';
import { useRunningAuditsStore } from '../model/runningAuditsStore';
import { oncePerTab } from '@/shared/lib/hmrSingleton';

export interface AnalysisCallbacks {
  onProgress: (data: AnalysisProgress) => void;
  onPartial:  (data: CategoryPartial)  => void;
  onComplete: (result: AnalysisResult) => void;
  /** Gemini's commentary, arriving after onComplete. Optional: not every caller wants it. */
  onInsights?: (data: AnalysisInsightsPayload) => void;
  /** `code` is set for the failures the UI can act on — currently SESSION_EXPIRED. */
  onError:    (message: string, code?: string) => void;
}

/**
 * Wires the four analysis events to callbacks; returns the detach. Exported so the
 * compare feature's short-lived sockets share the exact wiring — the two copies had
 * already drifted on how the error payload was unpacked.
 *
 */
export function attachAnalysisListeners(s: AppSocket, callbacks: AnalysisCallbacks): () => void {
  const onProgress = (data: AnalysisProgress)   => callbacks.onProgress(data);
  const onPartial  = (data: CategoryPartial)     => callbacks.onPartial(data);
  const onComplete = (result: AnalysisResult)    => callbacks.onComplete(result);
  const onInsights = (data: AnalysisInsightsPayload) => callbacks.onInsights?.(data);
  const onError    = (data: AnalysisErrorPayload) => callbacks.onError(data.message, data.code);

  s.on('analysis:progress', onProgress);
  s.on('analysis:partial',  onPartial);
  s.on('analysis:complete', onComplete);
  s.on('analysis:insights', onInsights);
  s.on('analysis:error',    onError);

  return () => {
    s.off('analysis:progress', onProgress);
    s.off('analysis:partial',  onPartial);
    s.off('analysis:complete', onComplete);
    s.off('analysis:insights', onInsights);
    s.off('analysis:error',    onError);
  };
}

/**
 * Keep the shell's running-audits list in step with the shared socket.
 *
 * A *separate*, permanent subscription rather than a hook into the callers' listeners,
 * because the whole point of the indicator is the case where the caller has gone: leaving
 * the analyzer detaches its handlers while the audit carries on, and a tracker built on
 * those handlers would freeze at whatever progress it last saw and never see the finish.
 *
 * Registered once, on the first audit of the session, and never removed — the socket is a
 * singleton and so is this.
 */
function ensureRunTracker(s: AppSocket): void {
  // Per tab, not per module instance: a hot reload of this file would otherwise attach a
  // second tracker beside the first, and every progress event would be applied twice.
  if (!oncePerTab('runTracker')) return;
  s.on('analysis:progress', (data: AnalysisProgress) => useRunningAuditsStore.getState().applyProgress(data));
  s.on('analysis:complete', (result: AnalysisResult) => useRunningAuditsStore.getState().endByAnalysisId(result.id));
  s.on('analysis:error',    (data: AnalysisErrorPayload) => useRunningAuditsStore.getState().endByAnalysisId(data.analysisId));
}

export interface StartAnalysisOptions {
  projectId?: string | undefined;
  formFactor?: AuditFormFactor | undefined;
  /** 'median' measures three times and reports the middle run — slower, far less noisy. */
  precision?: AuditPrecision | undefined;
}

export function startAnalysis(
  url: string,
  callbacks: AnalysisCallbacks,
  opts: StartAnalysisOptions = {},
): () => void {
  const s = getSocket();
  if (!s.connected) s.connect();
  ensureRunTracker(s);
  useRunningAuditsStore.getState().begin(url, '/app');
  const cleanup = attachAnalysisListeners(s, callbacks);
  s.emit('analysis:start', {
    url,
    ...(opts.projectId  ? { projectId:  opts.projectId }  : {}),
    ...(opts.formFactor ? { formFactor: opts.formFactor } : {}),
    ...(opts.precision  ? { precision:  opts.precision }  : {}),
  });
  return cleanup;
}

/**
 * Ask the server to abandon a running audit.
 *
 * The audit is real work — a Chrome per run, up to five runs on an unstable page — so
 * leaving it going after the person stopped waiting burns the CPU that every other audit
 * on the box is measured against. The server kills the workers; the caller detaches its
 * own listeners, so the error that killing them produces never reaches the UI.
 */
export function cancelAnalysis(analysisId: string | null): void {
  // Dropped from the indicator here rather than on the error the cancellation produces:
  // the caller detaches its listeners as part of stopping, so that error never arrives.
  useRunningAuditsStore.getState().endByAnalysisId(analysisId ?? undefined);

  const s = getSocket();
  if (!s.connected) return;
  s.emit('analysis:cancel', { analysisId });
}

export function joinAnalysis(callbacks: AnalysisCallbacks): () => void {
  const s = getSocket();
  return attachAnalysisListeners(s, callbacks);
}

export function emitAuthAuditStart(
  sessionId: string,
  url: string,
  callbacks: AnalysisCallbacks,
  formFactor?: AuditFormFactor,
): () => void {
  const s = getSocket();
  if (!s.connected) s.connect();
  ensureRunTracker(s);
  useRunningAuditsStore.getState().begin(url, '/app');
  const cleanup = attachAnalysisListeners(s, callbacks);
  s.emit('auth-audit:start', { sessionId, url, ...(formFactor ? { formFactor } : {}) });
  return cleanup;
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
