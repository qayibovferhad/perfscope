import type { NextFunction, Request, Response } from 'express';
import { isDbReady } from '../config/database.js';

/**
 * Set on every response while the database is down.
 *
 * The read endpoints answer with their empty shape in that state, which is what keeps the
 * dashboard on its empty state rather than an error panel — but an empty list and an empty
 * account look identical, and only one of them is worth telling the user about. This header
 * is that difference, carried out of band so no payload shape has to change.
 */
export const STORAGE_HEADER = 'X-Perfscope-Storage';

export function markStorageState(_req: Request, res: Response, next: NextFunction): void {
  if (!isDbReady()) res.setHeader(STORAGE_HEADER, 'unavailable');
  next();
}

/**
 * Refuse the request outright. For writes only: reads degrade to empty, but accepting a
 * write that cannot be stored would report success for data that was never saved.
 */
export function requireStorage(_req: Request, res: Response, next: NextFunction): void {
  if (isDbReady()) {
    next();
    return;
  }
  res.status(503).json({
    success: false,
    error:   'Storage is unavailable — the database is not connected, so nothing can be saved right now.',
    code:    'DB_UNAVAILABLE',
  });
}

/** Router-level form of the above: reads fall through to their own empty-shape guard. */
export function requireStorageForWrites(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET') {
    next();
    return;
  }
  requireStorage(req, res, next);
}
