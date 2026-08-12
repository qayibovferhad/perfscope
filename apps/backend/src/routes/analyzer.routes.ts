import { Router } from 'express';
import { lighthouseService } from '../services/lighthouse.service.js';
import { enrichWithAi, persistAudit, resolveOrCreateProject } from '../services/auditPipeline.js';
import { optionalAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { isValidUrl } from '../lib/url.js';
import { AppError, asyncHandler } from '../lib/errors.js';

export const analyzerRouter: Router = Router();

/**
 * POST /api/analyze — the REST audit path.
 *
 * The socket path is the real one; this survives because the Chrome extension uses it.
 * It used to live in `controllers/` — the only file there — with its own copy of the
 * AI enrichment (missing the per-resource half) and its own way of deciding which
 * project an audit belonged to. Both now come from auditPipeline, so the two entry
 * paths cannot describe the same audit differently.
 */
analyzerRouter.post('/analyze', optionalAuth, asyncHandler<AuthRequest>(async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string') throw new AppError(400, 'url field is required');
  if (!isValidUrl(url)) throw new AppError(400, 'Invalid URL. Must start with http:// or https://');

  const result = await lighthouseService.analyze(url);
  await enrichWithAi(result);

  // Saving is best-effort: an anonymous caller has nowhere to save to, and a storage
  // failure must not throw away an audit the caller already waited minutes for.
  let savedToHistory = false;
  if (req.userId) {
    try {
      const projectId = await resolveOrCreateProject(req.userId, result.url);
      await persistAudit(result, req.userId, projectId);
      savedToHistory = true;
    } catch (err) {
      console.error('[Analyzer] History save failed:', (err as Error).message);
    }
  }

  res.json({ success: true, data: result, savedToHistory });
}, 'Analysis failed'));
