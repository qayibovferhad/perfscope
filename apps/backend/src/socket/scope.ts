import { userIdFromToken } from '../middleware/auth.middleware.js';
import { resolveTeamScope } from '../services/team.service.js';
import { isDbReady } from '../config/database.js';

/**
 * Which account a socket's work belongs to.
 *
 * The REST side resolves this in one middleware; a socket has no middleware chain, so the
 * handshake carries the same two values — the token and, when the client is working inside
 * a team, its id — and this answers with the id every query and every stored document
 * should use: the **team's owner**, or the person themselves.
 *
 * Resolved lazily and memoised per connection rather than eagerly at connect: a connection
 * that never starts an audit should not cost a database read, and an event handler can
 * await it as cheaply as it can read a variable.
 */
export function socketScope(auth: unknown): () => Promise<string | undefined> {
  const { token, teamId } = (auth ?? {}) as { token?: string; teamId?: string };
  const actorId = userIdFromToken(token);

  let pending: Promise<string | undefined> | undefined;

  return () => {
    if (!pending) {
      pending = (async () => {
        if (!actorId || !teamId || !isDbReady()) return actorId;
        // Not a member (any more): their own data, exactly as the REST path falls back.
        const scope = await resolveTeamScope(actorId, teamId);
        return scope?.scopeId ?? actorId;
      })();
    }
    return pending;
  };
}
