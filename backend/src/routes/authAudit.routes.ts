import { Router, type Request, type Response } from 'express';
import { createAuthAuditSession, hasSession, destroySession } from '../services/authAuditSession.js';

export const authAuditRouter = Router();

// POST /api/auth-audit/session — open a visible browser at url, return sessionId
authAuditRouter.post('/auth-audit/session', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const sessionId = await createAuthAuditSession(url);
    return res.json({ sessionId });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to launch browser',
    });
  }
});

// GET /api/auth-audit/session/:sessionId — check if session is still alive
authAuditRouter.get('/auth-audit/session/:sessionId', (req: Request, res: Response) => {
  const id = req.params['sessionId'];
  if (typeof id === 'string' && hasSession(id)) return res.json({ ok: true });
  return res.status(404).json({ error: 'Session not found' });
});

// DELETE /api/auth-audit/session/:sessionId — close browser and end session
authAuditRouter.delete('/auth-audit/session/:sessionId', (req: Request, res: Response) => {
  const id = req.params['sessionId'];
  if (typeof id === 'string') destroySession(id);
  return res.json({ ok: true });
});
