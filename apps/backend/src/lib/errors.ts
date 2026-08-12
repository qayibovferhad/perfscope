import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Raised when an audit that injected a saved login session still landed on a
 * login screen — the session has expired, so the numbers would describe the
 * login page rather than the page the user asked about.
 */
export class SessionExpiredError extends Error {
  readonly code = 'SESSION_EXPIRED';

  constructor(readonly loginUrl: string) {
    super('Saved session has expired — the audit was redirected to a login page. Capture the session again.');
    this.name = 'SessionExpiredError';
  }
}

/**
 * A failure that already knows what the client should be told: the status, the
 * message, and optionally a code the UI can branch on.
 *
 * Thrown instead of `return res.status(400).json(...)` so a handler has one exit
 * path — a validation guard reads the same as the rest of the function, and the
 * response shape is decided in one place rather than at forty call sites.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * An unexpected throw, carrying the sentence the client gets. The real error is
 * kept as `cause` for the log — the client is told "Failed to load history", the
 * server records the stack.
 */
class HandlerFailure extends Error {
  constructor(readonly clientMessage: string, override readonly cause: unknown) {
    super(clientMessage);
    this.name = 'HandlerFailure';
  }
}

/**
 * Wraps an async route handler so a rejected promise becomes a response.
 *
 * Express does not await handlers. Before this, every route carried its own
 * try/catch — thirty-eight of them, all doing the same three things — and any route
 * that forgot left the request hanging until the 70-second server timeout, because
 * there was no terminal error middleware to catch it either.
 *
 * The generic is how `req.userId` gets a type: pass `AuthedRequest` on a route
 * behind `requireAuth` and the non-null assertions disappear.
 */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => unknown,
  /** What an *unexpected* failure tells the client. An AppError overrides it. */
  failureMessage = 'Server error',
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as unknown as Req, res, next)).catch((err: unknown) => {
      next(err instanceof AppError ? err : new HandlerFailure(failureMessage, err));
    });
  };
}

/**
 * The last handler in the chain: turns anything thrown into the one error shape the
 * client parses (`{ success: false, error }` — see packages/shared api/client).
 *
 * Logs with the method and path, which the old per-route `console.error('[history]', err)`
 * could not: a report of "it 500'd" used to start with guessing which route it was.
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // A handler that already answered and then threw must not answer twice; the
  // response is out, so all that is left to do is record it.
  if (res.headersSent) {
    console.error(`[${req.method} ${req.originalUrl}] threw after responding:`, err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
    return;
  }

  const failure = err instanceof HandlerFailure ? err : null;
  console.error(`[${req.method} ${req.originalUrl}]`, failure?.cause ?? err);
  res.status(500).json({ success: false, error: failure?.clientMessage ?? 'Server error' });
}
