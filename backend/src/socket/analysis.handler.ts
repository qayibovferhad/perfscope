import type { Server, Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  AnalysisProgress,
  CategoryPartial,
} from '../types/index.js';
import { lighthouseService } from '../services/lighthouse.service.js';
import { AiService } from '../services/ai.service.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function isValidUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function registerAnalysisSocket(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on('analysis:start', async (payload: { url: string }) => {
      const { url } = payload;

      if (!isValidUrl(url)) {
        socket.emit('analysis:error', { analysisId: '', message: 'Invalid URL format.' });
        return;
      }

      console.log(`[Socket] Analysis started: ${url}`);

      const onProgress = (data: AnalysisProgress) => socket.emit('analysis:progress', data);
      const onPartial  = (data: CategoryPartial)  => socket.emit('analysis:partial', data);

      lighthouseService.on('progress', onProgress);

      try {
        const result = await lighthouseService.analyzeStreaming(url, onPartial);

        // AI insights after all categories done
        if (AiService.isAvailable()) {
          const insights = await AiService.getInsights(result).catch((err: unknown) => {
            console.error('[AI] Failed:', err);
            return null;
          });
          if (insights) result.aiInsights = insights;
        }

        socket.emit('analysis:complete', result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        socket.emit('analysis:error', { analysisId: '', message });
      } finally {
        lighthouseService.off('progress', onProgress);
      }
    });

    socket.on('analysis:cancel', (payload: { analysisId: string }) => {
      lighthouseService.cancelAnalysis(payload.analysisId);
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
    });
  });
}
