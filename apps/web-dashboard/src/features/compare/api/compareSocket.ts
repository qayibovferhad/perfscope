import type { Socket } from 'socket.io-client';
import type { AuditFormFactor } from '@perfscope/shared';
import type { AnalysisCallbacks } from '@/entities/analysis';
import { createSocket } from '@/shared/api/socket';

function attachCallbacks(socket: Socket, callbacks: AnalysisCallbacks) {
  socket.on('analysis:progress', callbacks.onProgress);
  socket.on('analysis:partial',  callbacks.onPartial);
  socket.on('analysis:complete', callbacks.onComplete);
  socket.on('analysis:error',    (d: { message: string }) => callbacks.onError(d.message));
  return () => { socket.disconnect(); socket.removeAllListeners(); };
}

export function startCompareAnalysis(
  url: string,
  callbacks: AnalysisCallbacks,
  formFactor?: AuditFormFactor,
): () => void {
  const socket = createSocket();
  socket.connect();
  const cleanup = attachCallbacks(socket, callbacks);
  socket.emit('analysis:start', { url, formFactor });
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
