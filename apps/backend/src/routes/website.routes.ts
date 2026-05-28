import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { Website } from '../models/Website.model.js';
import { NightlyAuditService } from '../services/nightlyAudit.service.js';

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

// PATCH /api/websites/:id/automation — update automation settings (enabled, routes)
websiteRouter.patch('/websites/:id/automation', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as { enabled?: boolean; routes?: string[]; scheduleTime?: string };

    const update: Record<string, unknown> = {};
    if (typeof body.enabled === 'boolean')  update['automation.enabled']      = body.enabled;
    if (Array.isArray(body.routes))         update['automation.routes']        = body.routes;
    if (typeof body.scheduleTime === 'string' && /^\d{2}:\d{2}$/.test(body.scheduleTime))
                                            update['automation.scheduleTime']  = body.scheduleTime;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Provide enabled or routes to update' });
    }

    const website = await Website.findOneAndUpdate(
      { _id: req.params['id'], userId: req.userId },
      update,
      { returnDocument: 'after' },
    );
    if (!website) return res.status(404).json({ error: 'Website not found' });

    return res.json(website);
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/websites/:id/automation/run — manual trigger for a single website
websiteRouter.post('/websites/:id/automation/run', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const website = await Website.findOne({ _id: req.params['id'], userId: req.userId }).lean();
    if (!website) return res.status(404).json({ error: 'Website not found' });

    // Fire and forget — respond immediately, audit runs in background.
    NightlyAuditService.runForWebsite(String(req.params['id']), req.userId!).catch((err: unknown) => {
      console.error('[ManualAudit] Failed:', (err as Error).message);
    });

    return res.json({ ok: true, message: 'Audit started in background' });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/websites/:id
websiteRouter.delete('/websites/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await Website.deleteOne({ _id: req.params['id'], userId: req.userId });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});
