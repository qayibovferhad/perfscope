import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../lib/errors.js';
import { getAdvice, type AdviceScope } from '../services/advice.service.js';
import { emptyOnNoStorage } from '../middleware/storage.middleware.js';

export const adviceRouter: Router = Router();

adviceRouter.use('/advice', requireAuth);

/**
 * GET /api/advice?scope=overview|site&url=…
 *
 * Deliberately its own request rather than a field on `/api/overview`: the advice takes a
 * Gemini round trip and the page it decorates must not wait for it. Same shape as the
 * analyzer, where the scores arrive first and the commentary follows.
 *
 * Answers `null` — not an error — when Gemini is unconfigured or has nothing to say, so
 * the client's only job is to render it or not.
 */
adviceRouter.get(
  '/advice',
  emptyOnNoStorage(() => null),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const scope: AdviceScope = req.query['scope'] === 'site' ? 'site' : 'overview';
    const url = typeof req.query['url'] === 'string' ? req.query['url'] : undefined;

    ok(res, await getAdvice(req.userId, scope, url));
  }, 'Could not produce advice'),
);
