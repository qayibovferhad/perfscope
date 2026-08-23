import express, { type Application } from 'express';
import { createServer, type Server } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
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
import { cruxRouter }              from './routes/crux.routes.js';
import { registerAnalysisSocket } from './socket/analysis.handler.js';
import { markStorageState, STORAGE_HEADER } from './middleware/storage.middleware.js';
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

  // ── Middleware ───────────────────────────────────────────────────────────
  // The storage header has to be listed explicitly: a browser cannot read a custom
  // response header across origins unless the server exposes it.
  app.use(cors({ origin: config.clientUrl, exposedHeaders: [STORAGE_HEADER] }));
  app.use(express.json());
  app.use(markStorageState);

  // ── Routes ───────────────────────────────────────────────────────────────
  // Mounted at the root: it serves /rum.js as well as /api/rum, and carries its own
  // permissive CORS because both are called from other origins.
  app.use(rumRouter);

  app.use('/api', authRouter);
  app.use('/api', websiteRouter);
  app.use('/api', deployRouter);
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
