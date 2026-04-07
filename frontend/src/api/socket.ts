import { io, type Socket } from 'socket.io-client';
import type { AnalysisProgress, AnalysisResult, CategoryPartial } from '@/features/analyzer/types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3101';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, { autoConnect: false });
  }
  return socket;
}

export interface AnalysisCallbacks {
  onProgress: (data: AnalysisProgress) => void;
  onPartial:  (data: CategoryPartial) => void;
  onComplete: (result: AnalysisResult) => void;
  onError:    (message: string) => void;
}

export function startAnalysis(url: string, callbacks: AnalysisCallbacks): () => void {
  const s = getSocket();
  if (!s.connected) s.connect();

  const onProgress = (data: AnalysisProgress)    => callbacks.onProgress(data);
  const onPartial  = (data: CategoryPartial)      => callbacks.onPartial(data);
  const onComplete = (result: AnalysisResult)     => callbacks.onComplete(result);
  const onError    = (data: { message: string })  => callbacks.onError(data.message);

  s.on('analysis:progress', onProgress);
  s.on('analysis:partial',  onPartial);
  s.on('analysis:complete', onComplete);
  s.on('analysis:error',    onError);
  s.emit('analysis:start', { url });

  return () => {
    s.off('analysis:progress', onProgress);
    s.off('analysis:partial',  onPartial);
    s.off('analysis:complete', onComplete);
    s.off('analysis:error',    onError);
  };
}
