import type { Socket } from 'socket.io-client';
import type { AnalysisProgress, AnalysisResult, CategoryPartial, AuditFormFactor } from '@perfscope/shared';

/** How thoroughly an audit measures: one shot, or the median of three runs. */
export type AuditPrecision = 'single' | 'median';
import { getSocket } from '@/shared/api/socket';

export interface AnalysisCallbacks {
  onProgress: (data: AnalysisProgress) => void;
  onPartial:  (data: CategoryPartial)  => void;
  onComplete: (result: AnalysisResult) => void;
  /** `code` is set for the failures the UI can act on — currently SESSION_EXPIRED. */
  onError:    (message: string, code?: string) => void;
}

function attachListeners(s: Socket, callbacks: AnalysisCallbacks): () => void {
  const onProgress = (data: AnalysisProgress)   => callbacks.onProgress(data);
  const onPartial  = (data: CategoryPartial)     => callbacks.onPartial(data);
  const onComplete = (result: AnalysisResult)    => callbacks.onComplete(result);
  const onError    = (data: { message: string; code?: string }) => callbacks.onError(data.message, data.code);

  s.on('analysis:progress', onProgress);
  s.on('analysis:partial',  onPartial);
  s.on('analysis:complete', onComplete);
  s.on('analysis:error',    onError);

  return () => {
    s.off('analysis:progress', onProgress);
    s.off('analysis:partial',  onPartial);
    s.off('analysis:complete', onComplete);
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
  const cleanup = attachListeners(s, callbacks);
  s.emit('analysis:start', {
    url,
    ...(opts.projectId  ? { projectId:  opts.projectId }  : {}),
    ...(opts.formFactor ? { formFactor: opts.formFactor } : {}),
    ...(opts.precision  ? { precision:  opts.precision }  : {}),
  });
  return cleanup;
}

export function joinAnalysis(callbacks: AnalysisCallbacks): () => void {
  const s = getSocket();
  return attachListeners(s, callbacks);
}

export function emitAuthAuditStart(
  sessionId: string,
  url: string,
  callbacks: AnalysisCallbacks,
  formFactor?: AuditFormFactor,
): () => void {
  const s = getSocket();
  if (!s.connected) s.connect();
  const cleanup = attachListeners(s, callbacks);
  s.emit('auth-audit:start', { sessionId, url, ...(formFactor ? { formFactor } : {}) });
  return cleanup;
}
