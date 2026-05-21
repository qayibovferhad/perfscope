import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import type { AnalysisCallbacks } from '@/api/socket';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3101';

/**
 * Creates a dedicated socket instance per analysis so concurrent compare-side
 * analyses don't share event listeners and mix up results.
 */
export function startCompareAnalysis(url: string, callbacks: AnalysisCallbacks): () => void {
  const token = useAuthStore.getState().token;
  const socket = io(BACKEND_URL, { autoConnect: false, auth: token ? { token } : {} });
  socket.connect();

  socket.on('analysis:progress', callbacks.onProgress);
  socket.on('analysis:partial',  callbacks.onPartial);
  socket.on('analysis:complete', callbacks.onComplete);
  socket.on('analysis:error',    (d: { message: string }) => callbacks.onError(d.message));

  socket.emit('analysis:start', { url });

  return () => {
    socket.disconnect();
    socket.removeAllListeners();
  };
}
