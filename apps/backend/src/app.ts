import express, { type Application } from 'express';
import { createServer, type Server } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/index.js';
import { authRouter } from './routes/auth.routes.js';
import { websiteRouter } from './routes/website.routes.js';
import { analyzerRouter } from './routes/analyzer.routes.js';
import { historyRouter } from './routes/history.routes.js';
import { compareHistoryRouter } from './routes/compareHistory.routes.js';
import { adviceRouter }         from './routes/advice.routes.js';
import { authAuditRouter } from './routes/authAudit.routes.js';
import { competitorSessionRouter } from './routes/competitorSession.routes.js';
import { onboardingRouter } from './routes/onboarding.routes.js';
import { overviewRouter }   from './routes/overview.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { cliAuthRouter }           from './routes/cliAuth.routes.js';
import { rumRouter } from './routes/rum.routes.js';
import { deployRouter } from './routes/deploy.routes.js';
import { flowRouter } from './routes/flow.routes.js';
import { cruxRouter }              from './routes/crux.routes.js';
import { registerAnalysisSocket } from './socket/analysis.handler.js';
import { registerFlowSocket } from './socket/flow.handler.js';
import { markStorageState, STORAGE_HEADER } from './middleware/storage.middleware.js';
import { isDbReady } from './config/database.js';
import { errorMiddleware } from './lib/errors.js';
import type { ServerToClientEvents, ClientToServerEvents } from '@perfscope/shared';
import type { InterServerEvents, SocketData } from './types/socket.js';

/**
 * How long a request may block before the server hangs up.
 *
 * Deliberately short, and deliberately *not* raised to match `RUN_TIMEOUT_MS` (4 min) in
 * lighthouse.service.ts: this is server-wide, so a value big enough for an audit would let
 * every wedged request hold a socket for four minutes. The one route that legitimately runs
 * longer raises the limit for its own connection — see analyzer.routes.ts.
 */
const HTTP_TIMEOUT_MS = 70_000;

export function createApp(): { app: Application; httpServer: Server } {
  const app = express();
  const httpServer = createServer(app);

  httpServer.setTimeout(HTTP_TIMEOUT_MS);

  // ── Socket.io ────────────────────────────────────────────────────────────
  const io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: config.clientUrl, methods: ['GET', 'POST'] },
  });

  registerAnalysisSocket(io);
  registerFlowSocket(io);

  // ── Middleware ───────────────────────────────────────────────────────────
  /**
   * Security headers.
   *
   * `crossOriginResourcePolicy` is explicitly cross-origin, and that is not a formality:
   * helmet's default is `same-origin`, and this server serves `/rum.js` to be loaded as a
   * script *by other people's sites*. The default would have turned the RUM snippet into a
   * blocked request on every site that installed it — and the failure would have shown up
   * as "field data shows nothing", the same symptom as an unset key.
   */
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  /**
   * Compression, mounted before the routes so every JSON response goes through it. An
   * audit result is hundreds of kilobytes of audits, waterfall rows and treemap nodes, and
   * it is fetched again every time somebody reopens a stored run.
   */
  app.use(compression());

  // The storage header has to be listed explicitly: a browser cannot read a custom
  // response header across origins unless the server exposes it.
  app.use(cors({ origin: config.clientUrl, exposedHeaders: [STORAGE_HEADER] }));
  app.use(express.json());
  app.use(markStorageState);

  /**
   * Liveness and readiness in one, above the routers so nothing can gate it.
   *
   * There was no health route at all, which meant every check of "is the backend up" was
   * somebody loading a page — and a container platform has no page to load. `status` is
   * about the process; `database` is reported separately and deliberately does NOT make
   * this 503: the app is designed to serve empty shapes with no Mongo (see
   * storage.middleware), so a database outage is a degradation to report, not a reason to
   * have the orchestrator restart a server that is working as designed.
   */
  app.get('/health', (_req, res) => {
    res.json({
      status:    'ok',
      uptime:    Math.round(process.uptime()),
      database:  isDbReady() ? 'up' : 'down',
      version:   process.env['npm_package_version'] ?? '1.0.0',
    });
  });

  // ── Routes ───────────────────────────────────────────────────────────────
  // Mounted at the root: it serves /rum.js as well as /api/rum, and carries its own
  // permissive CORS because both are called from other origins.
  app.use(rumRouter);

  app.use('/api', authRouter);
  app.use('/api', websiteRouter);
  app.use('/api', deployRouter);
  app.use('/api', flowRouter);
  app.use('/api', analyzerRouter);
  app.use('/api', historyRouter);
  app.use('/api', compareHistoryRouter);
  app.use('/api', adviceRouter);
  app.use('/api', authAuditRouter);
  app.use('/api', competitorSessionRouter);
  app.use('/api', cruxRouter);
  app.use('/api', onboardingRouter);
  app.use('/api', overviewRouter);
  app.use('/api', notificationsRouter);
  app.use('/api/auth', cliAuthRouter);

  app.get('/', (_req, res) => {
    res.json({ name: 'PerfScope API', version: '1.0.0', status: 'running' });
  });

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  // Last in the chain, after the routes: anything a handler throws lands here and
  // becomes a response. Without it an uncaught throw hung until the 70s timeout.
  app.use(errorMiddleware);

  return { app, httpServer };
}
