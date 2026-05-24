import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
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
import { HistoryService } from '../services/history.service.js';
import { hasSession, extractSessionData, destroySession } from '../services/authAuditSession.js';
import { Website } from '../models/Website.model.js';
import { config } from '../config/index.js';

function extractUserId(socket: TypedSocket): string | undefined {
  try {
    const token = (socket.handshake.auth as { token?: string }).token;
    if (!token) return undefined;
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    return payload.sub;
  } catch {
    return undefined;
  }
}

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

    socket.on('analysis:start', async (payload: { url: string; projectId?: string }) => {
      const { url, projectId } = payload;

      if (!isValidUrl(url)) {
        socket.emit('analysis:error', { analysisId: '', message: 'Invalid URL format.' });
        return;
      }

      console.log(`[Socket] Analysis started: ${url}`);

      const onProgress = (data: AnalysisProgress) => socket.emit('analysis:progress', data);
      const onPartial  = (data: CategoryPartial)  => socket.emit('analysis:partial', data);

      lighthouseService.on('progress', onProgress);

      // Auto-inject saved session if this URL belongs to a website with a stored session
      const userId = extractUserId(socket);
      let savedSession: { cookies: unknown[]; localStorage: Record<string, string> } | null = null;
      if (userId) {
        try {
          const websites = await Website.find({ userId }).lean();
          const match = websites.find(w => url.startsWith(w.url));
          if (match?.session && (match.session.cookies.length > 0 || Object.keys(match.session.localStorage as object).length > 0)) {
            savedSession = {
              cookies:      match.session.cookies,
              localStorage: match.session.localStorage as Record<string, string>,
            };
            console.log(`[Socket] Using saved session for ${url}`);
          }
        } catch (err) {
          console.warn('[Socket] Failed to load saved session:', err);
        }
      }

      try {
        const result = savedSession
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? await lighthouseService.analyzeWithInjectedSession(url, savedSession as any, onPartial)
          : await lighthouseService.analyzeStreaming(url, onPartial);

        
        // AI insights + resource advice (parallel when both available)
        if (AiService.isAvailable()) {
          const criticals = (result.resources?.requests ?? [])
            .filter((r) => r.isCritical)
            .slice(0, 6);

          const [insights, adviceMap] = await Promise.all([
            AiService.getInsights(result).catch((err: unknown) => {
              console.error('[AI] Insights failed:', err);
              return null;
            }),
            criticals.length > 0
              ? AiService.getResourceAdvice(criticals).catch((err: unknown) => {
                  console.error('[AI] Resource advice failed:', err);
                  return new Map<string, string>();
                })
              : Promise.resolve(new Map<string, string>()),
          ]);

          if (insights) result.aiInsights = insights;

          if (adviceMap.size > 0 && result.resources) {
            for (const req of result.resources.requests) {
              const advice = adviceMap.get(req.url);
              if (advice) req.advice = advice;
            }
          }
        }

        HistoryService.save({
          id:        result.id,
          shortId:   result.id.slice(0, 7),
          url:       result.url,
          timestamp: result.timestamp,
          scores:    result.scores,
          metrics:   result.metrics,
        }, userId, projectId).catch(err => console.warn('[History] Save failed:', err));

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

    socket.on('auth-audit:start', async (payload: { sessionId: string; url: string; projectId?: string }) => {
      const { sessionId, url, projectId } = payload;

      if (!isValidUrl(url)) {
        socket.emit('analysis:error', { analysisId: '', message: 'Invalid URL format.' });
        return;
      }

      if (!hasSession(sessionId)) {
        socket.emit('analysis:error', { analysisId: '', message: 'Auth session not found or expired. Please start over.' });
        return;
      }

      // Extract session data (visible browser stays open for re-use).
      const sessionData = await extractSessionData(sessionId);

      // Auto-persist session to the matching website so future audits use it automatically.
      const userId = extractUserId(socket);
      if (userId) {
        Website.find({ userId }).lean().then((sites) => {
          const match = sites.find(w => url.startsWith(w.url as string));
          if (match) {
            Website.findByIdAndUpdate(match._id, {
              session: { ...sessionData, capturedAt: new Date() },
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      const onProgress = (data: AnalysisProgress) => socket.emit('analysis:progress', data);
      const onPartial  = (data: CategoryPartial)  => socket.emit('analysis:partial',  data);

      lighthouseService.on('progress', onProgress);

      try {
        const result = await lighthouseService.analyzeWithInjectedSession(url, sessionData, onPartial);

        if (AiService.isAvailable()) {
          const criticals = (result.resources?.requests ?? [])
            .filter((r) => r.isCritical)
            .slice(0, 6);

          const [insights, adviceMap] = await Promise.all([
            AiService.getInsights(result).catch((err: unknown) => {
              console.error('[AI] Insights failed:', err);
              return null;
            }),
            criticals.length > 0
              ? AiService.getResourceAdvice(criticals).catch((err: unknown) => {
                  console.error('[AI] Resource advice failed:', err);
                  return new Map<string, string>();
                })
              : Promise.resolve(new Map<string, string>()),
          ]);

          if (insights) result.aiInsights = insights;

          if (adviceMap.size > 0 && result.resources) {
            for (const req of result.resources.requests) {
              const advice = adviceMap.get(req.url);
              if (advice) req.advice = advice;
            }
          }
        }

        const userId = extractUserId(socket);
        HistoryService.save({
          id:        result.id,
          shortId:   result.id.slice(0, 7),
          url:       result.url,
          timestamp: result.timestamp,
          scores:    result.scores,
          metrics:   result.metrics,
        }, userId, projectId).catch(err => console.warn('[History] Save failed:', err));

        socket.emit('analysis:complete', result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        socket.emit('analysis:error', { analysisId: '', message });
      } finally {
        lighthouseService.off('progress', onProgress);
      }
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
    });
  });
}
