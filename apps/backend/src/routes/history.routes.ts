import { Router, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { HistoryModel } from '../models/History.model.js';
import { HistoryService } from '../services/history.service.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';

export const historyRouter: Router = Router();

// GET /api/history/all  — all entries for authenticated user
historyRouter.get('/history/all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await HistoryService.getAll(req.userId!);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[history]', err);
    res.status(500).json({ success: false, error: 'Failed to load history' });
  }
});

// GET /api/history?url=...  — entries for a specific URL
historyRouter.get('/history', requireAuth, async (req: AuthRequest, res: Response) => {
  const url = req.query['url'];
  if (!url || typeof url !== 'string') {
    res.status(400).json({ success: false, error: 'url query param required' });
    return;
  }
  try {
    const data = await HistoryService.get(url, req.userId!);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[history]', err);
    res.status(500).json({ success: false, error: 'Failed to load history' });
  }
});

// GET /api/history/:id  — full analysis result for a single audit
// ─── Public share links ──────────────────────────────────────────────────────

// POST /api/history/:id/share — mint (or return) a public link token for an audit
historyRouter.post('/history/:id/share', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await HistoryModel.findOne({ analysisId: String(req.params['id']), userId: req.userId! });
    if (!doc) return res.status(404).json({ success: false, error: 'Audit not found' });
    if (!doc.fullResult) return res.status(409).json({ success: false, error: 'Full result not stored for this audit' });

    if (!doc.shareToken) {
      doc.shareToken = randomBytes(16).toString('hex');
      await doc.save();
    }
    return res.json({ success: true, token: doc.shareToken });
  } catch (err) {
    console.error('[history]', err);
    return res.status(500).json({ success: false, error: 'Failed to create share link' });
  }
});

// DELETE /api/history/:id/share — revoke the public link
historyRouter.delete('/history/:id/share', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await HistoryModel.updateOne(
      { analysisId: String(req.params['id']), userId: req.userId! },
      { shareToken: null },
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[history]', err);
    return res.status(500).json({ success: false, error: 'Failed to revoke share link' });
  }
});

// GET /api/public/report/:token — no auth; the unguessable token IS the credential
historyRouter.get('/public/report/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params['token'] ?? '');
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    const doc = await HistoryModel.findOne({ shareToken: token }).lean();
    if (!doc?.fullResult) return res.status(404).json({ success: false, error: 'Report not found' });

    return res.json({ success: true, data: doc.fullResult, sharedAt: doc.createdAt });
  } catch (err) {
    console.error('[history]', err);
    return res.status(500).json({ success: false, error: 'Failed to load report' });
  }
});

historyRouter.get('/history/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await HistoryService.getById(String(req.params['id']), req.userId!);
    if (!data) {
      res.status(404).json({ success: false, error: 'Not found or result not stored' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('[history]', err);
    res.status(500).json({ success: false, error: 'Failed to load result' });
  }
});

// DELETE /api/history/:id  — remove a single audit
historyRouter.delete('/history/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await HistoryService.remove(String(req.params['id']), req.userId!);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Audit not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[history]', err);
    res.status(500).json({ success: false, error: 'Failed to delete audit' });
  }
});

// GET /api/projects/:id/audits  — project audit history grouped by route
historyRouter.get('/projects/:id/audits', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await HistoryService.getByProject(String(req.params['id']), req.userId!);
    if (!data) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('[history]', err);
    res.status(500).json({ success: false, error: 'Failed to load project audits' });
  }
});
