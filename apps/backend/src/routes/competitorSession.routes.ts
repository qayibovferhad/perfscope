import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { CompetitorSession } from '../models/CompetitorSession.model.js';
import { asyncHandler } from '../lib/errors.js';

export const competitorSessionRouter: Router = Router();

// Path-scoped: every router shares the bare `/api` mount, so an unscoped `.use()`
// would also gate the routers mounted after this one.
competitorSessionRouter.use('/competitor-sessions', requireAuth);

// GET /api/competitor-sessions
competitorSessionRouter.get(
  '/competitor-sessions',
  asyncHandler<AuthedRequest>(async (req, res) => {
    const sessions = await CompetitorSession.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(sessions);
  }),
);

// DELETE /api/competitor-sessions/:id
competitorSessionRouter.delete(
  '/competitor-sessions/:id',
  asyncHandler<AuthedRequest>(async (req, res) => {
    await CompetitorSession.deleteOne({ _id: req.params['id']!, userId: req.userId });
    res.json({ ok: true });
  }),
);
