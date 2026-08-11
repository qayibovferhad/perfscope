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
import { enrichWithAi, persistAudit } from '../services/auditPipeline.js';
import { hasSession, extractSessionData } from '../services/authAuditSession.js';
import { Website } from '../models/Website.model.js';
import { CompetitorSession } from '../models/CompetitorSession.model.js';
import { config } from '../config/index.js';
import { sameOrigin, isValidUrl, hostOf, hostPrefixRegex } from '../lib/url.js';
import { SessionExpiredError } from '../lib/errors.js';
import { v4 as uuidv4 } from 'uuid';

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

/** The user's website that owns this URL, matched on hostname since audits run per route. */
async function findWebsiteByHost(userId: string, url: string) {
  const host = hostOf(url);
  if (!host) return null;

  return Website.findOne({
    userId,
    url: { $regex: hostPrefixRegex(host).source, $options: 'i' },
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

/**
 * A stored session that no longer authenticates is worse than no session: every
 * later audit silently measures a login page. Drop it and flag the site so the
 * dashboard asks for a fresh capture.
 */
async function dropStaleSession(userId: string | undefined, url: string, loginUrl: string): Promise<void> {
  if (!userId) return;
  const site = await findWebsiteByHost(userId, url);
  if (!site) return;
  site.set('session', null);
  site.set('requiresLogin', { url, loginUrl, detectedAt: new Date() });
  await site.save();
}

export function registerAnalysisSocket(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on('analysis:start', async (payload: { url: string; projectId?: string; formFactor?: 'mobile' | 'desktop'; precision?: 'single' | 'median' }) => {
      const { url, projectId } = payload;
      const formFactor = payload.formFactor === 'mobile' ? 'mobile' as const : undefined;

      if (!isValidUrl(url)) {
        socket.emit('analysis:error', { analysisId: '', message: 'Invalid URL format.' });
        return;
      }

      console.log(`[Socket] Analysis started: ${url}`);

      // Own the id up front so this socket only forwards its own audit's progress —
      // concurrent audits share the service's event emitter.
      const analysisId = uuidv4();
      const runs = payload.precision === 'median' ? 3 : 1;

      const onProgress = (data: AnalysisProgress) => {
        if (data.analysisId === analysisId) socket.emit('analysis:progress', data);
      };
      const onPartial  = (data: CategoryPartial) => {
        if (data.analysisId === analysisId) socket.emit('analysis:partial', data);
      };

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
          const match = allSources.find(s => s.session && sameOrigin(url, s.url));
          if (match?.session) {
            // Mongo drops an empty localStorage map, and a cookies-only capture is
            // perfectly normal — neither may crash the audit that wants to use it.
            const cookies = match.session.cookies ?? [];
            const ls      = (match.session.localStorage ?? {}) as Record<string, string>;
            if (cookies.length > 0 || Object.keys(ls).length > 0) {
              savedSession = { cookies, localStorage: ls };
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
          ? await lighthouseService.analyzeWithInjectedSession(url, savedSession as any, onPartial, { formFactor, analysisId })
          : await lighthouseService.analyzeStreaming(url, onPartial, { formFactor, runs, analysisId });

        await enrichWithAi(result);

        // Derived from the audited URL — see resolveProjectId for why the client's value
        // cannot be trusted on its own.
        const ownerProjectId = await resolveProjectId(userId, result.url, projectId);

        persistAudit(result, userId, ownerProjectId).catch(err => console.warn('[History] Save failed:', err));

        recordLoginWall(userId, result.url, result.authRedirectDetected)
          .catch(err => console.warn('[Website] Login-wall flag failed:', err));

        socket.emit('analysis:complete', result);
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          await dropStaleSession(userId, url, err.loginUrl)
            .catch((e: unknown) => console.warn('[Socket] Failed to drop stale session:', e));
        }
        const message = err instanceof Error ? err.message : 'Analysis failed';
        socket.emit('analysis:error', { analysisId, message });
      } finally {
        lighthouseService.off('progress', onProgress);
      }
    });

    socket.on('analysis:cancel', (payload: { analysisId: string }) => {
      lighthouseService.cancelAnalysis(payload.analysisId);
    });

    socket.on('auth-audit:start', async (payload: { sessionId: string; url: string; projectId?: string; context?: 'competitor'; formFactor?: 'mobile' | 'desktop' }) => {
      const { sessionId, url, projectId, context } = payload;
      const formFactor = payload.formFactor === 'mobile' ? 'mobile' as const : undefined;

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
            const match = sites.find(w => sameOrigin(url, w.url as string));
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

      const analysisId = uuidv4();
      const onProgress = (data: AnalysisProgress) => {
        if (data.analysisId === analysisId) socket.emit('analysis:progress', data);
      };
      const onPartial  = (data: CategoryPartial) => {
        if (data.analysisId === analysisId) socket.emit('analysis:partial', data);
      };

      lighthouseService.on('progress', onProgress);

      try {
        const result = await lighthouseService.analyzeWithInjectedSession(url, sessionData, onPartial, { formFactor, analysisId });

        await enrichWithAi(result);

        // Derived from the audited URL — see resolveProjectId for why the client's value
        // cannot be trusted on its own.
        const ownerProjectId = await resolveProjectId(userId, result.url, projectId);

        persistAudit(result, userId, ownerProjectId).catch(err => console.warn('[History] Save failed:', err));

        recordLoginWall(userId, result.url, result.authRedirectDetected)
          .catch(err => console.warn('[Website] Login-wall flag failed:', err));

        socket.emit('analysis:complete', result);
      } catch (err) {
        const message = err instanceof SessionExpiredError
          ? 'The captured session did not authenticate — log in inside the opened browser, then run the audit again.'
          : err instanceof Error ? err.message : 'Analysis failed';
        socket.emit('analysis:error', { analysisId, message });
      } finally {
        lighthouseService.off('progress', onProgress);
      }
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
    });
  });
}
