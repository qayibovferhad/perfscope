import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../lib/errors.js';
import { getAdvice, type AdviceScope } from '../services/advice.service.js';
import { recordAdviceAction } from '../services/adviceAction.service.js';
import { emptyOnNoStorage, requireStorage } from '../middleware/storage.middleware.js';
import type { AiAdviceAction } from '@perfscope/shared';

const ACTION_KINDS: ReadonlySet<string> = new Set(['audit', 'schedule', 'compare', 'budgets']);

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

/**
 * POST /api/advice/acted { kind, url }
 *
 * Fired when a step's action link is clicked (see `features/advisor/api/recordAction.ts`
 * on the client). Fire-and-forget telemetry, not a step the user waits on — a later
 * `getAdvice` call reads it back to say "you did this, here's what happened".
 */
adviceRouter.post(
  '/advice/acted',
  requireStorage,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { kind, url } = req.body as { kind?: unknown; url?: unknown };
    if (typeof kind !== 'string' || !ACTION_KINDS.has(kind)) {
      throw new AppError(400, 'Unknown action kind');
    }
    if (typeof url !== 'string' || !url.trim()) {
      throw new AppError(400, 'Missing url');
    }

    await recordAdviceAction(req.userId, kind as AiAdviceAction['kind'], url);
    ok(res, null);
  }, 'Could not record action'),
);
