import type { Response, NextFunction } from 'express';
import type { TeamRole } from '@perfscope/shared';
import { canWrite } from '@perfscope/shared';
import { userIdFromToken, type AuthRequest } from './auth.middleware.js';
import { resolveTeamScope } from '../services/team.service.js';
import { isDbReady } from '../config/database.js';
import { AppError } from '../lib/errors.js';

/**
 * Turning "who is asking" into "whose data is this".
 *
 * Every query in this codebase filters on `userId`, and teams do not change that: a member
 * working inside a team has their request resolved to the **owner's** id, so the site they
 * open is the same document the owner sees rather than a copy that has to be kept in step.
 * That is the whole reason this is one middleware and not a column on twelve models.
 *
 * It runs above the routers — never as a `router.use()`, which would leak into every router
 * mounted after it on the shared `/api` prefix — and it writes `req.scopeUserId` rather
 * than `req.userId` directly, because `requireAuth` runs later per route and would
 * overwrite it. `requireAuth` reads it back; that hand-off is the only coupling.
 */
export interface ScopedRequest extends AuthRequest {
  /** The person behind the request. Attribution — never a scope. */
  actorId?:    string;
  /** The account the request acts on: the team's owner, or the actor working alone. */
  scopeUserId?: string;
  teamId?:     string;
  teamRole?:   TeamRole;
}

/** The client names the team it is working in on every request, the way it names its token. */
export const TEAM_HEADER = 'x-team-id';

/**
 * Routes exempt from the read-only guard.
 *
 * A viewer may not write anything about the *product* — but they must still be able to
 * accept an invitation and to leave a team they were added to, both of which are writes.
 * Matched on the path prefix rather than by mounting the guard selectively, because these
 * routers share the bare `/api` mount with everything else. `req.path` has that mount
 * stripped off by Express — the optional `api/` is there so the pattern still holds if this
 * is ever mounted at the root.
 */
const SELF_SERVICE = /^\/(api\/)?(teams|invites)\b/;

export async function attachTeamScope(req: ScopedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const actorId = header?.startsWith('Bearer ') ? userIdFromToken(header.slice(7)) : undefined;
  if (actorId) req.actorId = actorId;

  const teamId = req.headers[TEAM_HEADER];
  if (!actorId || typeof teamId !== 'string' || !teamId || !isDbReady()) return next();

  try {
    const scope = await resolveTeamScope(actorId, teamId);
    // A team id the caller is not (or no longer) in reads as no team at all: somebody
    // removed while a tab was open should fall back to their own data, not have every
    // request in that tab fail.
    if (!scope) return next();

    req.scopeUserId = scope.scopeId;
    req.teamId      = scope.teamId ?? '';
    req.teamRole    = scope.role;

    if (!canWrite(scope.role) && req.method !== 'GET' && !SELF_SERVICE.test(req.path)) {
      return next(new AppError(403, 'You have view-only access to this team', 'TEAM_READ_ONLY'));
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
