import type { AuditFormFactor, AuditPrecision } from '@perfscope/shared';
import { attachAnalysisListeners, type AnalysisCallbacks } from '@/entities/analysis';
import { createSocket, type AppSocket } from '@/shared/api/socket';

// The event wiring is the entity's; only the teardown differs — these sockets are
// per-analysis and die with it, so the whole connection goes, not just the listeners.
function attachCallbacks(socket: AppSocket, callbacks: AnalysisCallbacks) {
  attachAnalysisListeners(socket, callbacks);
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
  socket.emit('analysis:start', {
    url,
    ...(formFactor ? { formFactor } : {}),
    ...(precision  ? { precision }  : {}),
  });
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
  socket.emit('auth-audit:start', {
    sessionId, url, context: 'competitor',
    ...(formFactor ? { formFactor } : {}),
  });
  return cleanup;
}
