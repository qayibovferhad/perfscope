import { io } from 'socket.io-client';
import type { AnalysisCallbacks } from '@/entities/analysis';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3101';

let _getToken: () => string | null = () => null;
export function configureCompareSocketToken(getter: () => string | null) { _getToken = getter; }

function makeSocket() {
  const token = _getToken();
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
