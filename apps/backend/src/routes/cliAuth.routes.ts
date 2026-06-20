import { Router } from 'express';

const router = Router();

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
    res.status(400).json({ error: 'Invalid code' });
    return;
  }
  pending.set(code, { at: Date.now() });
  res.json({ ok: true });
});

// Browser (CliAuthPage) → store token against the code
router.post('/cli/complete', (req, res) => {
  const { code, token } = req.body as { code?: string; token?: string };
  if (!code || !token) { res.status(400).json({ error: 'Missing fields' }); return; }
  const entry = pending.get(code);
  if (!entry)           { res.status(404).json({ error: 'Unknown or expired code' }); return; }
  entry.token = token;
  res.json({ ok: true });
});

// CLI → poll for token
router.get('/cli/poll', (req, res) => {
  const code = req.query['code'] as string | undefined;
  if (!code)            { res.status(400).json({ error: 'Missing code' }); return; }
  const entry = pending.get(code);
  if (!entry)           { res.status(404).json({ error: 'Unknown or expired code — re-run login' }); return; }
  if (entry.token) {
    const token = entry.token;
    pending.delete(code);
    res.json({ token });
    return;
  }
  res.json({ pending: true });
});

export { router as cliAuthRouter };
