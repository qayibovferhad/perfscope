import type { Socket } from 'socket.io-client';
import type { AuditFormFactor } from '@perfscope/shared';
import type { AnalysisCallbacks, AuditPrecision } from '@/entities/analysis';
import { createSocket } from '@/shared/api/socket';

function attachCallbacks(socket: Socket, callbacks: AnalysisCallbacks) {
  socket.on('analysis:progress', callbacks.onProgress);
  socket.on('analysis:partial',  callbacks.onPartial);
  socket.on('analysis:complete', callbacks.onComplete);
  socket.on('analysis:error',    (d: { message: string; code?: string }) => callbacks.onError(d.message, d.code));
  return () => { socket.disconnect(); socket.removeAllListeners(); };
}

export function startCompareAnalysis(
  url: string,
  callbacks: AnalysisCallbacks,
  formFactor?: AuditFormFactor,
  // Both sides pass the same value, which is the point: a median-of-three run against a
  // single-shot one is not a comparison, it is two different measurements.
  precision?: AuditPrecision,
): () => void {
  const socket = createSocket();
  socket.connect();
  const cleanup = attachCallbacks(socket, callbacks);
  socket.emit('analysis:start', { url, formFactor, precision });
  return cleanup;
}

export function startCompareAuthAudit(
  sessionId: string,
  url: string,
  callbacks: AnalysisCallbacks,
  formFactor?: AuditFormFactor,
): () => void {
  const socket = createSocket();
  socket.connect();
  const cleanup = attachCallbacks(socket, callbacks);
  socket.emit('auth-audit:start', { sessionId, url, context: 'competitor', formFactor });
  return cleanup;
}
