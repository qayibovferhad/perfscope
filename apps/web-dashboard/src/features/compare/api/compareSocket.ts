import type { AuditFormFactor, AuditPrecision } from '@perfscope/shared';
import { attachAnalysisListeners, type AnalysisCallbacks } from '@/entities/analysis';
import { createSocket, type AppSocket } from '@/shared/api/socket';

// The event wiring is the entity's; only the teardown differs — these sockets are
// per-analysis and die with it, so the whole connection goes, not just the listeners.
/**
 * Deliberately *not* tracked in the shell's running-audits indicator.
 *
 * That indicator's promise is "this is still going, and you can go back and watch it".
 * These sockets are per-analysis and die with the page: leaving compare mid-run orphans
 * the client side of it, so there is nothing left to go back to. The server finishes the
 * audit and stores it, and history is where it turns up — which is the honest answer, and
 * a pill offering to reopen a run that cannot be reopened is not.
 */
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
