import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { CliAuthService } from '../services/cliAuth.service.js';
import { issueTokens } from '../services/authTokens.service.js';
import { User } from '../models/User.model.js';
import { AppError, asyncHandler } from '../lib/errors.js';

const router: Router = Router();

/** Codes are echoed back to the CLI, so cap what a caller can make the server hold. */
const MAX_CODE_LEN = 128;

function requireCode(value: unknown): string {
  if (!value || typeof value !== 'string' || value.length > MAX_CODE_LEN) {
    throw new AppError(400, 'Invalid code');
  }
  return value;
}

// CLI → register a new login code
router.post('/cli/init', asyncHandler(async (req, res) => {
  const code = requireCode((req.body as { code?: unknown }).code);
  await CliAuthService.register(code);
  ok(res);
}, 'Could not start CLI login'));

// Browser (CliAuthPage) → mint a session for the CLI and store it against the code.
//
// Authorisation still comes from the verified Authorization header and never from the body
// — a body token would let anyone who learned a pending code plant an arbitrary token into
// the waiting CLI. What changed is *which* token the CLI receives: it used to be a copy of
// the browser's, which was fine while that lived thirty days and is not now that it lives
// thirty minutes. The CLI gets a session of its own, which it can renew, and which shows up
// separately when somebody signs out of everything.
router.post('/cli/complete', requireAuth, asyncHandler<AuthRequest>(async (req, res) => {
  const code = requireCode((req.body as { code?: unknown }).code);

  const user = await User.findById(req.userId);
  if (!user) throw new AppError(401, 'Unauthorized');

  const tokens = await issueTokens(user, 'cli');
  if (!await CliAuthService.complete(code, tokens)) {
    throw new AppError(404, 'Unknown or expired code');
  }
  ok(res);
}, 'Could not complete CLI login'));

// CLI → poll for token
router.get('/cli/poll', asyncHandler(async (req, res) => {
  const code = requireCode(req.query['code']);
  const result = await CliAuthService.claim(code);

  if (result.status === 'unknown') throw new AppError(404, 'Unknown or expired code — re-run login');
  if (result.status === 'pending') { ok(res, { pending: true }); return; }
  ok(res, result.tokens);
}, 'Could not check CLI login'));

export { router as cliAuthRouter };
