import type {
  AnalysisProgress, AnalysisResult, CategoryPartial, AuditFormFactor,
  AuditPrecision, AnalysisErrorPayload, AnalysisInsightsPayload,
} from '@perfscope/shared';
import { getSocket, type AppSocket } from '@/shared/api/socket';

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
export function cancelAnalysis(analysisId: string): void {
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
  const cleanup = attachAnalysisListeners(s, callbacks);
  s.emit('auth-audit:start', { sessionId, url, ...(formFactor ? { formFactor } : {}) });
  return cleanup;
}
