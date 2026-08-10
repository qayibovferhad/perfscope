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
import { hasSession, extractSessionData } from '../services/authAuditSession.js';
import { Website } from '../models/Website.model.js';
import { CompetitorSession } from '../models/CompetitorSession.model.js';
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

/** The user's website that owns this URL, matched on hostname since audits run per route. */
async function findWebsiteByHost(userId: string, url: string) {
  let host: string;
  try { host = new URL(url).hostname; } catch { return null; }

  return Website.findOne({
    userId,
    url: { $regex: `^https?://${host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`, $options: 'i' },
  });
}

/**
 * The client sends projectId from the page's query string, which goes stale as soon as
 * the user edits the URL in the analyzer: the audit then gets filed under whichever
 * project they happened to open last, or under none at all. Since the project detail page
 * queries strictly by projectId, such an audit shows up on the wrong site or nowhere.
 *
 * The audited URL is the reliable signal, so derive the project from it and only fall
 * back to the supplied id when no website matches.
 */
async function resolveProjectId(
  userId: string | undefined,
  url: string,
  provided: string | undefined,
): Promise<string | undefined> {
  if (!userId) return provided;
  try {
    const site = await findWebsiteByHost(userId, url);
    return site ? String(site._id) : provided;
  } catch {
    return provided;
  }
}

/**
 * Remembers on the Website document whether an audit hit a login screen, so the
 * dashboard can flag the site instead of the warning living only in the one analysis
 * result the user happened to be looking at.
 *
 * Self-correcting: the flag records which URL was walled off, and a later clean audit of
 * that same URL clears it. Auditing some other route never clears another route's wall.
 */
async function recordLoginWall(
  userId: string | undefined,
  url: string,
  detected: { finalUrl: string } | undefined,
): Promise<void> {
  if (!userId) return;

  const site = await findWebsiteByHost(userId, url);
  if (!site) return;

  if (detected) {
    site.set('requiresLogin', { url, loginUrl: detected.finalUrl, detectedAt: new Date() });
    await site.save();
    return;
  }

  const current = site.get('requiresLogin') as { url?: string } | null;
  if (current && current.url === url) {
    site.set('requiresLogin', null);
    await site.save();
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

      // Auto-inject saved session — check Website first, then CompetitorSession
      const userId = extractUserId(socket);
      let savedSession: { cookies: unknown[]; localStorage: Record<string, string> } | null = null;
      if (userId) {
        try {
          const [websites, competitorSessions] = await Promise.all([
            Website.find({ userId }).lean(),
            CompetitorSession.find({ userId }).lean(),
          ]);
          const allSources = [
            ...websites.map(w => ({ url: w.url, session: w.session })),
            ...competitorSessions.map(c => ({ url: c.url, session: c.session })),
          ];
          const match = allSources.find(s => url.startsWith(s.url) && s.session);
          if (match?.session) {
            const s = match.session;
            if (s.cookies.length > 0 || Object.keys(s.localStorage as object).length > 0) {
              savedSession = { cookies: s.cookies, localStorage: s.localStorage as Record<string, string> };
              console.log(`[Socket] Using saved session for ${url}`);
            }
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

        // Derived from the audited URL — see resolveProjectId for why the client's value
        // cannot be trusted on its own.
        const ownerProjectId = await resolveProjectId(userId, result.url, projectId);

        HistoryService.save({
          id:        result.id,
          shortId:   result.id.slice(0, 7),
          url:       result.url,
          timestamp: result.timestamp,
          scores:    result.scores,
          metrics:   result.metrics,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, userId, ownerProjectId, result as unknown as Record<string, any>).catch(err => console.warn('[History] Save failed:', err));

        recordLoginWall(userId, result.url, result.authRedirectDetected)
          .catch(err => console.warn('[Website] Login-wall flag failed:', err));

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

    socket.on('auth-audit:start', async (payload: { sessionId: string; url: string; projectId?: string; context?: 'competitor' }) => {
      const { sessionId, url, projectId, context } = payload;

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

      // Auto-persist session — competitor sessions go to CompetitorSession, others to Website.
      const userId = extractUserId(socket);
      if (userId) {
        const sessionPayload = { ...sessionData, capturedAt: new Date() };
        const origin   = new URL(url).origin;
        const hostname = new URL(url).hostname;

        if (context === 'competitor') {
          CompetitorSession.findOneAndUpdate(
            { userId, url: origin },
            { $set: { session: sessionPayload, name: hostname } },
            { upsert: true, new: true },
          ).catch(() => {});
        } else {
          Website.find({ userId }).lean().then(async (sites) => {
            const match = sites.find(w => url.startsWith(w.url as string));
            // Same rule as PATCH /websites/:id/session — a captured session answers the
            // login-wall warning, so it is cleared here too.
            if (match) {
              await Website.findByIdAndUpdate(match._id, { session: sessionPayload, requiresLogin: null });
            } else {
              await Website.findOneAndUpdate(
                { userId, url: origin },
                { $set: { session: sessionPayload, name: hostname, requiresLogin: null } },
                { upsert: true, new: true },
              );
            }
          }).catch(() => {});
        }
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
        // Derived from the audited URL — see resolveProjectId for why the client's value
        // cannot be trusted on its own.
        const ownerProjectId = await resolveProjectId(userId, result.url, projectId);

        HistoryService.save({
          id:        result.id,
          shortId:   result.id.slice(0, 7),
          url:       result.url,
          timestamp: result.timestamp,
          scores:    result.scores,
          metrics:   result.metrics,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, userId, ownerProjectId, result as unknown as Record<string, any>).catch(err => console.warn('[History] Save failed:', err));

        recordLoginWall(userId, result.url, result.authRedirectDetected)
          .catch(err => console.warn('[Website] Login-wall flag failed:', err));

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
