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
import { authAuditRouter } from './routes/authAudit.routes.js';
import { competitorSessionRouter } from './routes/competitorSession.routes.js';
import { onboardingRouter } from './routes/onboarding.routes.js';
import { cliAuthRouter }           from './routes/cliAuth.routes.js';
import { rumRouter } from './routes/rum.routes.js';
import { cruxRouter }              from './routes/crux.routes.js';
import { registerAnalysisSocket } from './socket/analysis.handler.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './types/index.js';

export function createApp(): { app: Application; httpServer: Server } {
  const app = express();
  const httpServer = createServer(app);

  // Increase server timeout for long-running Lighthouse analyses
  httpServer.setTimeout(70_000);

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
  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json());

  // ── Routes ───────────────────────────────────────────────────────────────
  // Mounted at the root: it serves /rum.js as well as /api/rum, and carries its own
  // permissive CORS because both are called from other origins.
  app.use(rumRouter);

  app.use('/api', authRouter);
  app.use('/api', websiteRouter);
  app.use('/api', analyzerRouter);
  app.use('/api', historyRouter);
  app.use('/api', compareHistoryRouter);
  app.use('/api', authAuditRouter);
  app.use('/api', competitorSessionRouter);
  app.use('/api', cruxRouter);
  app.use('/api', onboardingRouter);
  app.use('/api/auth', cliAuthRouter);

  app.get('/', (_req, res) => {
    res.json({ name: 'PerfScope API', version: '1.0.0', status: 'running' });
  });

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  return { app, httpServer };
}
