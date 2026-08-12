import type { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  AnalysisProgress,
  AnalysisResult,
  CategoryPartial,
} from '../types/index.js';
import { lighthouseService } from '../services/lighthouse.service.js';
import { enrichWithAi, persistAudit } from '../services/auditPipeline.js';
import { hasSession, extractSessionData } from '../services/authAuditSession.js';
import { findWebsiteByHost } from '../services/websiteLookup.js';
import { recordLoginWall, dropStaleSession } from '../services/loginWall.service.js';
import { findSessionFor, persistCapturedSession } from '../services/sessionStore.js';
import { userIdFromToken } from '../middleware/auth.middleware.js';
import { isValidUrl } from '../lib/url.js';
import { SessionExpiredError } from '../lib/errors.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/** Median precision measures three times and reports the middle run whole. */
const MEDIAN_RUNS = 3;

type PartialCallback = (data: CategoryPartial) => void;

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

interface RunAuditParams {
  socket:    TypedSocket;
  url:       string;
  userId:    string | undefined;
  projectId: string | undefined;
  /** Performs the measurement. Gets the id-scoped partial callback and the analysisId. */
  measure:   (onPartial: PartialCallback, analysisId: string) => Promise<AnalysisResult>;
  /** What an expired session should say on this entry path. */
  expiredMessage: (err: SessionExpiredError) => string;
}

/**
 * Everything both entry paths do around the measurement itself: own the analysis id,
 * forward only this audit's events, enrich, persist, flag the login wall, and report.
 *
 * The two handlers were ~70% identical and had already drifted — only `analysis:start`
 * dropped a stale session when one expired, so an `auth-audit` run that failed to
 * authenticate left the session it had just stored in place, ready to be injected into
 * every later audit of that origin.
 */
async function runAudit({
  socket, url, userId, projectId, measure, expiredMessage,
}: RunAuditParams): Promise<void> {
  // Own the id up front so this socket only forwards its own audit's progress —
  // concurrent audits share the service's event emitter.
  const analysisId = uuidv4();

  const onProgress = (data: AnalysisProgress) => {
    if (data.analysisId === analysisId) socket.emit('analysis:progress', data);
  };
  const onPartial: PartialCallback = (data) => {
    if (data.analysisId === analysisId) socket.emit('analysis:partial', data);
  };

  lighthouseService.on('progress', onProgress);

  try {
    const result = await measure(onPartial, analysisId);

    await enrichWithAi(result);

    // Derived from the audited URL — see resolveProjectId for why the client's value
    // cannot be trusted on its own.
    const ownerProjectId = await resolveProjectId(userId, result.url, projectId);

    persistAudit(result, userId, ownerProjectId)
      .catch(err => console.warn('[History] Save failed:', err));

    recordLoginWall(userId, result.url, result.authRedirectDetected)
      .catch(err => console.warn('[Website] Login-wall flag failed:', err));

    socket.emit('analysis:complete', result);
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      await dropStaleSession(userId, url, err.loginUrl)
        .catch((e: unknown) => console.warn('[Socket] Failed to drop stale session:', e));
    }

    const message = err instanceof SessionExpiredError
      ? expiredMessage(err)
      : err instanceof Error ? err.message : 'Analysis failed';

    socket.emit('analysis:error', {
      analysisId,
      message,
      ...(err instanceof SessionExpiredError ? { code: err.code } : {}),
    });
  } finally {
    lighthouseService.off('progress', onProgress);
  }
}

export function registerAnalysisSocket(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    const userId = userIdFromToken((socket.handshake.auth as { token?: string }).token);

    socket.on('analysis:start', async (payload) => {
      const { url, projectId } = payload;
      const formFactor = payload.formFactor === 'mobile' ? 'mobile' as const : undefined;

      if (!isValidUrl(url)) {
        socket.emit('analysis:error', { analysisId: '', message: 'Invalid URL format.' });
        return;
      }

      console.log(`[Socket] Analysis started: ${url}`);

      const runs = payload.precision === 'median' ? MEDIAN_RUNS : 1;

      // A session captured earlier for this exact origin is injected automatically, so a
      // login-walled page does not have to be re-captured before every run.
      let savedSession = null;
      if (userId) {
        savedSession = await findSessionFor(userId, url)
          .catch(err => { console.warn('[Socket] Failed to load saved session:', err); return null; });
        if (savedSession) console.log(`[Socket] Using saved session for ${url}`);
      }

      await runAudit({
        socket, url, userId, projectId,
        measure: (onPartial, analysisId) => savedSession
          ? lighthouseService.analyzeWithInjectedSession(url, savedSession, onPartial, { formFactor, analysisId })
          : lighthouseService.analyzeStreaming(url, onPartial, { formFactor, runs, analysisId }),
        expiredMessage: err => err.message,
      });
    });

    socket.on('analysis:cancel', (payload) => {
      lighthouseService.cancelAnalysis(payload.analysisId);
    });

    socket.on('auth-audit:start', async (payload) => {
      const { sessionId, url, projectId, context } = payload;
      const formFactor = payload.formFactor === 'mobile' ? 'mobile' as const : undefined;

      if (!isValidUrl(url)) {
        socket.emit('analysis:error', { analysisId: '', message: 'Invalid URL format.' });
        return;
      }

      if (!hasSession(sessionId)) {
        socket.emit('analysis:error', {
          analysisId: '',
          message: 'Auth session not found or expired. Please start over.',
        });
        return;
      }

      // The visible browser stays open for re-use after the harvest.
      const sessionData = await extractSessionData(sessionId);

      if (userId) {
        persistCapturedSession(userId, url, sessionData, context === 'competitor' ? 'competitor' : 'own')
          .catch(err => console.warn('[Socket] Failed to persist captured session:', err));
      }

      await runAudit({
        socket, url, userId, projectId,
        measure: (onPartial, analysisId) =>
          lighthouseService.analyzeWithInjectedSession(url, sessionData, onPartial, { formFactor, analysisId }),
        expiredMessage: () =>
          'The captured session did not authenticate — log in inside the opened browser, then run the audit again.',
      });
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
    });
  });
}
