import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AuthRequest extends Request {
  userId?: string;
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
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
