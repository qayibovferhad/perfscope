import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import type { AnalysisProgress, AnalysisResult, CategoryPartial } from '@/entities/analysis';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3101';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().token;
    socket = io(BACKEND_URL, {
      autoConnect: false,
      auth: token ? { token } : {},
    });
  }
  return socket;
}

export interface AnalysisCallbacks {
  onProgress: (data: AnalysisProgress) => void;
  onPartial:  (data: CategoryPartial)  => void;
  onComplete: (result: AnalysisResult) => void;
  onError:    (message: string)        => void;
}

function attachListeners(s: Socket, callbacks: AnalysisCallbacks): () => void {
  const onProgress = (data: AnalysisProgress)   => callbacks.onProgress(data);
  const onPartial  = (data: CategoryPartial)     => callbacks.onPartial(data);
  const onComplete = (result: AnalysisResult)    => callbacks.onComplete(result);
  const onError    = (data: { message: string }) => callbacks.onError(data.message);

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

export function startAnalysis(url: string, callbacks: AnalysisCallbacks, projectId?: string): () => void {
  const s = getSocket();
  if (!s.connected) s.connect();
  const cleanup = attachListeners(s, callbacks);
  s.emit('analysis:start', { url, ...(projectId ? { projectId } : {}) });
  return cleanup;
}

export function joinAnalysis(callbacks: AnalysisCallbacks): () => void {
  const s = getSocket();
  return attachListeners(s, callbacks);
}

export function emitAuthAuditStart(sessionId: string, url: string, callbacks: AnalysisCallbacks): () => void {
  const s = getSocket();
  if (!s.connected) s.connect();
  const cleanup = attachListeners(s, callbacks);
  s.emit('auth-audit:start', { sessionId, url });
  return cleanup;
}
