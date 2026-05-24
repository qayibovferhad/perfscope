import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { CompetitorSession } from '../models/CompetitorSession.model.js';

export const competitorSessionRouter = Router();

// GET /api/competitor-sessions
competitorSessionRouter.get('/competitor-sessions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await CompetitorSession.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.json(sessions);
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/competitor-sessions/:id
competitorSessionRouter.delete('/competitor-sessions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await CompetitorSession.deleteOne({ _id: req.params.id, userId: req.userId });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});
