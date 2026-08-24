import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { lighthouseService, RUN_TIMEOUT_MS } from '../services/lighthouse.service.js';
import { attachPreviousRun, enrichWithAi, persistAudit, resolveOrCreateProject } from '../services/auditPipeline.js';
import { optionalAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { isValidUrl } from '../lib/url.js';
import { assertPublicTarget } from '../lib/ssrf.js';
import { AppError, asyncHandler } from '../lib/errors.js';

export const analyzerRouter: Router = Router();

/**
 * POST /api/analyze — the REST audit path.
 *
 * **No first-party client uses this any more.** The Chrome extension was its last
 * consumer and moved to the socket, because this path is capped by `HTTP_TIMEOUT_MS`
 * (70s in app.ts) while an audit is allowed `RUN_TIMEOUT_MS` (4 minutes): a slow site
 * reported failure to the caller while the audit carried on server-side, and a retry
 * started a second one competing for the same CPU.
 *
 * Kept because it is a published endpoint someone may be scripting against, and because
 * `createApiClient().analyzeUrl` is part of the shared package's public surface. Removing
 * both is a deliberate call, not refactor fallout — but nothing in this repo would notice.
 *
 * It used to live in `controllers/` — the only file there — with its own copy of the
 * AI enrichment (missing the per-resource half) and its own way of deciding which
 * project an audit belonged to. Both now come from auditPipeline, so the two entry
 * paths cannot describe the same audit differently.
 */
analyzerRouter.post('/analyze', optionalAuth, asyncHandler<AuthRequest>(async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string') throw new AppError(400, 'url field is required');
  if (!isValidUrl(url)) throw new AppError(400, 'Invalid URL. Must start with http:// or https://');
  // No-op in development, where auditing a local dev server is the point — see lib/ssrf.ts.
  await assertPublicTarget(url, 'audit target');

  // The server hangs up at HTTP_TIMEOUT_MS (70s), and an audit is allowed four minutes.
  // A slow site therefore reported failure to the caller while the audit carried on
  // server-side — and a retry started a second one competing for the same CPU. Raised for
  // this connection only, because the global limit is what protects every other route from
  // a wedged request; the extra minute is for the AI enrichment and the history write that
  // follow the run.
  req.setTimeout(RUN_TIMEOUT_MS + 60_000);

  const result = await lighthouseService.analyze(url);
  // No-op for an anonymous caller — there is no history to compare against.
  const previous = await attachPreviousRun(result, req.userId);
  await enrichWithAi(result, { previous });

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

  ok(res, { result, savedToHistory });
}, 'Analysis failed'));
