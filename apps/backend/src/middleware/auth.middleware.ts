import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

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

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string };
      req.userId = payload.sub;
    } catch { /* invalid token — continue unauthenticated */ }
  }
  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized', code: 'NO_TOKEN' });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    return next();
  } catch (err) {
    // Expired is the common case (30d tokens) — the client shows a "session expired"
    // message for it, so keep it distinguishable from a tampered/malformed token.
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}
