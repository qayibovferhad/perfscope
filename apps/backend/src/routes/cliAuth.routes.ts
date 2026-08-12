import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';

const router: Router = Router();

interface PendingEntry { token?: string; at: number }
const pending = new Map<string, PendingEntry>();

// Purge stale codes every minute (TTL = 10 min)
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pending) {
    if (v.at < cutoff) pending.delete(k);
  }
}, 60_000).unref();

// CLI → register a new login code
router.post('/cli/init', (req, res) => {
  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string' || code.length > 128) {
    res.status(400).json({ success: false, error: 'Invalid code' });
    return;
  }
  pending.set(code, { at: Date.now() });
  res.json({ ok: true });
});

// Browser (CliAuthPage) → store token against the code.
// The token handed to the CLI comes from the verified Authorization header, never the
// body: a body token would let anyone who learned a pending code plant an arbitrary
// token into the waiting CLI.
router.post('/cli/complete', requireAuth, (req: AuthRequest, res) => {
  const { code } = req.body as { code?: string };
  if (!code)  { res.status(400).json({ success: false, error: 'Missing code' }); return; }
  const entry = pending.get(code);
  if (!entry) { res.status(404).json({ success: false, error: 'Unknown or expired code' }); return; }
  entry.token = (req.headers.authorization as string).slice(7);
  res.json({ ok: true });
});

// CLI → poll for token
router.get('/cli/poll', (req, res) => {
  const code = req.query['code'] as string | undefined;
  if (!code)            { res.status(400).json({ success: false, error: 'Missing code' }); return; }
  const entry = pending.get(code);
  if (!entry)           { res.status(404).json({ success: false, error: 'Unknown or expired code — re-run login' }); return; }
  if (entry.token) {
    const token = entry.token;
    pending.delete(code);
    res.json({ token });
    return;
  }
  res.json({ pending: true });
});

export { router as cliAuthRouter };
