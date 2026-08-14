/**
 * A fixed-window counter with its own sweeper.
 *
 * Extracted from rum.routes because a rate limiter is infrastructure, not routing — but
 * only the limiter. The other in-memory Maps that look similar are not the same thing:
 * crux.service and rum's key lookup are TTL caches (they hold an answer), cliAuth's
 * pending codes are one-shot handshake state, authAuditSession holds live browser
 * handles. One abstraction over all four would fit none of them.
 */
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  // Keeps the map from growing once a key goes quiet.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) if (now > entry.resetAt) windows.delete(key);
  }, windowMs).unref();

  return function overLimit(key: string): boolean {
    const now = Date.now();
    const entry = windows.get(key);
    if (!entry || now > entry.resetAt) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    entry.count += 1;
    return entry.count > max;
  };
}
