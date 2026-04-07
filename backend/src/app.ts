import express, { type Application } from 'express';
import { createServer, type Server } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import { config } from './config/index.js';
import { analyzerRouter } from './routes/analyzer.routes.js';
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
  app.use('/api', analyzerRouter);

  app.get('/', (_req, res) => {
    res.json({ name: 'PerfScope API', version: '1.0.0', status: 'running' });
  });

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  return { app, httpServer };
}
