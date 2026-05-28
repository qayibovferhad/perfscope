import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import type { AnalysisCallbacks } from '@/api/socket';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3101';

/**
 * Creates a dedicated socket instance per analysis so concurrent compare-side
 * analyses don't share event listeners and mix up results.
 */
function makeSocket() {
  const token = useAuthStore.getState().token;
  return io(BACKEND_URL, { autoConnect: false, auth: token ? { token } : {} });
}

function attachCallbacks(socket: ReturnType<typeof io>, callbacks: AnalysisCallbacks) {
  socket.on('analysis:progress', callbacks.onProgress);
  socket.on('analysis:partial',  callbacks.onPartial);
  socket.on('analysis:complete', callbacks.onComplete);
  socket.on('analysis:error',    (d: { message: string }) => callbacks.onError(d.message));
  return () => { socket.disconnect(); socket.removeAllListeners(); };
}

export function startCompareAnalysis(url: string, callbacks: AnalysisCallbacks): () => void {
  const socket = makeSocket();
  socket.connect();
  const cleanup = attachCallbacks(socket, callbacks);
  socket.emit('analysis:start', { url });
  return cleanup;
}

export function startCompareAuthAudit(sessionId: string, url: string, callbacks: AnalysisCallbacks): () => void {
  const socket = makeSocket();
  socket.connect();
  const cleanup = attachCallbacks(socket, callbacks);
  socket.emit('auth-audit:start', { sessionId, url, context: 'competitor' });
  return cleanup;
}
