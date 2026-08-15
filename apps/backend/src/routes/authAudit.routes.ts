import { Router } from 'express';
import { ok } from '../lib/respond.js';
import type { AuthAuditSessionResponse } from '@perfscope/shared';
import {
  createAuthAuditSession, hasSession, destroySession, extractSessionData,
} from '../services/authAuditSession.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AppError, asyncHandler } from '../lib/errors.js';

export const authAuditRouter: Router = Router();

// Opening a session launches a visible browser on this machine — never anonymous. This
// used to be enforced only by accident (an unscoped requireAuth in a router mounted
// earlier); now it is explicit. Path-scoped for the same reason that one was a bug.
authAuditRouter.use('/auth-audit', requireAuth);

/** Every route below addresses one live browser; there is nothing to say without an id. */
function sessionIdOf(raw: unknown): string {
  const id = typeof raw === 'string' ? raw : '';
  if (!id || !hasSession(id)) throw new AppError(404, 'Session not found or already closed');
  return id;
}

// POST /api/auth-audit/session — open a visible browser at url, return sessionId
authAuditRouter.post('/auth-audit/session', asyncHandler(async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) throw new AppError(400, 'url is required');

  const body: AuthAuditSessionResponse = { sessionId: await createAuthAuditSession(url) };
  ok(res, body);
}, 'Failed to launch browser'));

// GET /api/auth-audit/session/:sessionId — check if the session is still alive
authAuditRouter.get('/auth-audit/session/:sessionId', asyncHandler(async (req, res) => {
  sessionIdOf(req.params['sessionId']);
  ok(res);
}));

// GET /api/auth-audit/session/:sessionId/extract — harvest cookies + localStorage,
// then close the browser. The socket path keeps its browser open for re-use; this one
// is the extension's single-shot equivalent.
authAuditRouter.get('/auth-audit/session/:sessionId/extract', asyncHandler(async (req, res) => {
  const id   = sessionIdOf(req.params['sessionId']);
  const data = await extractSessionData(id);
  destroySession(id);
  ok(res, data);
}, 'Failed to extract session data'));

// DELETE /api/auth-audit/session/:sessionId — close browser and end session.
// Idempotent: closing an already-closed session is the caller getting what they asked for.
authAuditRouter.delete('/auth-audit/session/:sessionId', asyncHandler(async (req, res) => {
  const id = req.params['sessionId'];
  if (typeof id === 'string') destroySession(id);
  ok(res);
}));
