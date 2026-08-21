import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../lib/errors.js';

export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * What a request looks like once it is past `requireAuth`.
 *
 * `AuthRequest.userId` has to stay optional — `optionalAuth` leaves it unset — which
 * is why every authenticated handler used to write `req.userId!`. Pass this to
 * `asyncHandler<AuthedRequest>` instead and the assertion is gone: the guarantee is
 * stated once, where the middleware actually makes it.
 */
export interface AuthedRequest extends Request {
  userId: string;
}

/**
 * The user behind a token, or undefined if there isn't one.
 *
 * Exported because the Socket.io handshake needs the same check without an Express
 * request — it had its own third copy of `jwt.verify(token, config.jwtSecret)`.
 */
export function userIdFromToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  try {
    return (jwt.verify(token, config.jwtSecret) as { sub: string }).sub;
  } catch {
    return undefined;
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    // Assigned only when there is one: `exactOptionalPropertyTypes` treats an explicit
    // `undefined` as different from an absent property.
    const userId = userIdFromToken(header.slice(7));
    if (userId) req.userId = userId;
  }
  next();
}

// Failures flow through `next(new AppError(...))` rather than hand-built
// `res.status().json()` envelopes — this middleware predates the errorMiddleware
// convention and was the last place still assembling the response shape by hand.
export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Unauthorized', 'NO_TOKEN'));
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    return next();
  } catch (err) {
    // Expired is the common case (30d tokens) — the client shows a "session expired"
    // message for it, so keep it distinguishable from a tampered/malformed token.
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'Token expired', 'TOKEN_EXPIRED'));
    }
    return next(new AppError(401, 'Invalid token', 'INVALID_TOKEN'));
  }
}
