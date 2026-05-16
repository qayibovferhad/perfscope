import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { Website } from '../models/Website.model.js';

export const websiteRouter = Router();

// GET /api/websites
websiteRouter.get('/websites', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const websites = await Website.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.json(websites);
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/websites
websiteRouter.post('/websites', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { url, name } = req.body as { url: string; name?: string };
    if (!url) return res.status(400).json({ error: 'url is required' });

    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const website = await Website.findOneAndUpdate(
      { userId: req.userId, url: normalized },
      { url: normalized, name: name ?? '' },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return res.status(201).json(website);
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/websites/:id/session — save extracted session data to the website doc
websiteRouter.patch('/websites/:id/session', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { cookies = [], localStorage: ls = {} } = req.body as {
      cookies?: unknown[];
      localStorage?: Record<string, string>;
    };

    const website = await Website.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { session: { cookies, localStorage: ls, capturedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!website) return res.status(404).json({ error: 'Website not found' });

    return res.json(website);
  } catch (err) {
    console.error('[Website session]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/websites/:id
websiteRouter.delete('/websites/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await Website.deleteOne({ _id: req.params.id, userId: req.userId });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});
