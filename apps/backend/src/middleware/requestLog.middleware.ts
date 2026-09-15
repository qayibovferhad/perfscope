import type { RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { log, runWithRequestContext } from '../lib/logger.js';
import { increment, observeDuration } from '../lib/metrics.js';

/** Header a proxy or a client may set to carry its own id in; echoed back either way. */
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * One line per request, and an id every line written while handling it carries.
 *
 * The server had no request log at all: a report of "it was slow at four o'clock" had
 * nothing to look at, and an error line three services deep could not be tied to the call
 * that caused it. The id is generated here (or taken from the proxy's header, so a trace
 * that starts at the edge stays one trace) and put in an AsyncLocalStorage the logger
 * reads — no parameter threading, and a line written from inside a promise chain still
 * belongs to its request.
 *
 * Logged on `finish`, so the status and the duration are real rather than intended.
 * `/health` is skipped at info level: a container healthcheck every 30s is two thousand
 * lines a day saying nothing. It is still logged at debug, where asking for noise is the
 * point.
 */
export const requestLog: RequestHandler = (req, res, next) => {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId = (typeof incoming === 'string' && incoming.length <= 200 ? incoming : null) ?? randomUUID();
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const startedAt = process.hrtime.bigint();

  runWithRequestContext({ requestId }, () => {
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      // Labelled by status *class*, not status: a label whose values are unbounded is how
      // a scraper's memory becomes the outage. `path` is left off for the same reason —
      // `/report/<token>` alone would mint a series per share link.
      const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
      increment('perfscope_http_requests_total', 'HTTP requests handled', { method: req.method, status: statusClass });
      observeDuration('perfscope_http_request_duration_seconds', 'HTTP request duration', ms / 1000, { method: req.method });

      const fields = {
        method:   req.method,
        // The path only — a query string carries share tokens and reset tokens, and this
        // line is the one thing written for every single request.
        path:     req.path,
        status:   res.statusCode,
        ms:       Math.round(ms),
        ip:       req.ip,
      };
      // A 5xx is the server's fault and belongs in the stream a host watches; a 4xx is the
      // caller's and is ordinary traffic.
      if (res.statusCode >= 500)     log.warn('http', 'request failed', fields);
      else if (req.path === '/health') log.debug('http', 'request', fields);
      else                            log.info('http', 'request', fields);
    });

    next();
  });
};
