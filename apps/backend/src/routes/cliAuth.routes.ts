import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { CliAuthService } from '../services/cliAuth.service.js';
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
  res.json({ ok: true });
}, 'Could not start CLI login'));

// Browser (CliAuthPage) → store token against the code.
// The token handed to the CLI comes from the verified Authorization header, never the
// body: a body token would let anyone who learned a pending code plant an arbitrary
// token into the waiting CLI.
router.post('/cli/complete', requireAuth, asyncHandler<AuthRequest>(async (req, res) => {
  const code  = requireCode((req.body as { code?: unknown }).code);
  const token = (req.headers.authorization as string).slice(7);

  if (!await CliAuthService.complete(code, token)) {
    throw new AppError(404, 'Unknown or expired code');
  }
  res.json({ ok: true });
}, 'Could not complete CLI login'));

// CLI → poll for token
router.get('/cli/poll', asyncHandler(async (req, res) => {
  const code = requireCode(req.query['code']);
  const result = await CliAuthService.claim(code);

  if (result.status === 'unknown') throw new AppError(404, 'Unknown or expired code — re-run login');
  if (result.status === 'pending') { res.json({ pending: true }); return; }
  res.json({ token: result.token });
}, 'Could not check CLI login'));

export { router as cliAuthRouter };
