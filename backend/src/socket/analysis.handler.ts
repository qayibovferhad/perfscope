import type { Server, Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  AnalysisProgress,
} from '../types/index.js';
import { lighthouseService } from '../services/lighthouse.service.js';

type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ─── URL Validation ───────────────────────────────────────────────────────────

function isValidUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Socket Handler ───────────────────────────────────────────────────────────

export function registerAnalysisSocket(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on('analysis:start', async (payload: { url: string }) => {
      const { url } = payload;

      if (!isValidUrl(url)) {
        socket.emit('analysis:error', {
          analysisId: '',
          message: 'Invalid URL format. Must start with http:// or https://',
        });
        return;
      }

      console.log(`[Socket] Analysis started: ${url} (${socket.id})`);

      const onProgress = (data: AnalysisProgress): void => {
        socket.emit('analysis:progress', data);
      };

      lighthouseService.on('progress', onProgress);

      try {
        const result = await lighthouseService.analyze(url);
        socket.emit('analysis:complete', result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        socket.emit('analysis:error', { analysisId: '', message });
      } finally {
        lighthouseService.off('progress', onProgress);
      }
    });

    socket.on('analysis:cancel', (payload: { analysisId: string }) => {
      const { analysisId } = payload;
      const cancelled = lighthouseService.cancelAnalysis(analysisId);
      console.log(`[Socket] Cancel: ${analysisId} — ${cancelled ? 'success' : 'not found'}`);
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
    });
  });
}
