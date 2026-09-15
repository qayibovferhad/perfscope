import { AsyncLocalStorage } from 'async_hooks';

/**
 * The one way this server writes a line.
 *
 * Two formats, one call site. On a laptop it prints exactly what `console.log('[Scope] …')`
 * printed before — the prefix, the message, the extra values — because that output is what
 * anyone developing here reads all day. In a deployment it prints one JSON object per line,
 * because a container's stdout is the only thing a log collector gets and a human-formatted
 * line has to be parsed back apart by regex before anything can be filtered by it.
 *
 * Fields, not interpolation, wherever the value is a thing rather than prose: `{ url }`
 * survives as a queryable field, `${url}` inside the message does not. Messages that were
 * already sentences stayed sentences — rewriting seventy of them into field bags would
 * have lost the reasons they say out loud.
 *
 * `log.error` also reports the error onward (`lib/errorReporting.ts`) when a DSN is
 * configured, so nothing needs to remember to do both.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SEVERITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Set once at start-up (`configureLogger`), so tests can drive it without env vars. */
let threshold = SEVERITY.info;
let asJson = false;

export function configureLogger(options: { level?: string; format?: 'json' | 'text' }): void {
  const level = options.level?.toLowerCase();
  if (level && level in SEVERITY) threshold = SEVERITY[level as LogLevel];
  if (options.format) asJson = options.format === 'json';
}

/** What the current log lines are being written as — for the one line that announces it. */
export function loggerSettings(): { level: LogLevel; format: 'json' | 'text' } {
  const level = (Object.keys(SEVERITY) as LogLevel[]).find(l => SEVERITY[l] === threshold) ?? 'info';
  return { level, format: asJson ? 'json' : 'text' };
}

// ─── Request context ─────────────────────────────────────────────────────────

/**
 * The id of the request a line belongs to, carried without being passed.
 *
 * Every log written while handling a request — from a route, a service three calls deep,
 * or a promise that resolves later in the same chain — comes out with the same
 * `requestId`. That is the difference between a log you can read and a log you can follow:
 * with a hundred concurrent audits, lines interleave, and grouping them afterwards is
 * otherwise guesswork.
 */
interface RequestContext { requestId: string }

const contextStore = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return contextStore.run(context, fn);
}

export function currentRequestId(): string | undefined {
  return contextStore.getStore()?.requestId;
}

// ─── Redaction ───────────────────────────────────────────────────────────────

/**
 * Field names whose values never reach a log.
 *
 * A captured login session is the reason this exists rather than a nice-to-have: the
 * auth-audit flow holds real cookies for someone else's account, and a stray
 * `log.debug('session', 'captured', session)` would write them to disk on a server the
 * account's owner has never heard of. Bearer tokens and reset tokens are the same shape of
 * mistake. See `redactSession` in `models/session.schema.ts` for the same rule on the wire.
 */
const SECRET_KEY = /(token|password|secret|cookie|authorization|apikey|api_key|jwt|session)/i;

const REDACTED = '[redacted]';

function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  // Deep objects are rare in a log field and cheap to truncate; unbounded recursion over
  // an audit result is not.
  if (depth >= 4) return '[deep]';
  if (Array.isArray(value)) return value.slice(0, 20).map(v => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? REDACTED : redact(val, depth + 1);
  }
  return out;
}

/** Errors are not JSON-serialisable — `JSON.stringify(new Error('x'))` is `{}`. */
function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name:    err.name,
      message: err.message,
      ...(err.stack ? { stack: err.stack } : {}),
      ...(err.cause !== undefined ? { cause: serializeError(err.cause) } : {}),
    };
  }
  return { message: String(err) };
}

export type LogFields = Record<string, unknown> & { err?: unknown };

function prepare(fields: LogFields | undefined): Record<string, unknown> | undefined {
  if (!fields) return undefined;
  const { err, ...rest } = fields;
  const prepared = redact(rest) as Record<string, unknown>;
  if (err !== undefined) prepared['err'] = serializeError(err);
  return Object.keys(prepared).length ? prepared : undefined;
}

// ─── Writing ─────────────────────────────────────────────────────────────────

/** A circular reference in a field must not take the process down mid-log. */
function stringify(line: Record<string, unknown>): string {
  try {
    return JSON.stringify(line);
  } catch {
    return JSON.stringify({ ...line, fields: '[unserialisable]' });
  }
}

function write(level: LogLevel, scope: string, message: string, fields?: LogFields): void {
  if (SEVERITY[level] < threshold) return;

  const prepared = prepare(fields);
  const requestId = currentRequestId();
  // warn and error to stderr, the rest to stdout: that split is what lets a host separate
  // "something happened" from "something is wrong" without parsing anything.
  const sink = SEVERITY[level] >= SEVERITY.warn ? console.error : console.log;

  if (asJson) {
    sink(stringify({
      ts: new Date().toISOString(),
      level,
      scope,
      msg: message,
      ...(requestId ? { requestId } : {}),
      ...(prepared ?? {}),
    }));
    return;
  }

  const prefix = `[${scope}]${requestId ? ` (${requestId.slice(0, 8)})` : ''}`;
  if (prepared) sink(`${prefix} ${message}`, prepared);
  else          sink(`${prefix} ${message}`);
}

export const log = {
  debug: (scope: string, message: string, fields?: LogFields) => write('debug', scope, message, fields),
  info:  (scope: string, message: string, fields?: LogFields) => write('info',  scope, message, fields),
  warn:  (scope: string, message: string, fields?: LogFields) => write('warn',  scope, message, fields),
  /**
   * An error line, and a report if one is configured. Deliberately the same call: a code
   * path that logs an error and forgets to report it is how an outage stays invisible.
   */
  error: (scope: string, message: string, fields?: LogFields) => {
    write('error', scope, message, fields);
    void reportError(scope, message, fields);
  },
};

// ─── Onward reporting ────────────────────────────────────────────────────────

/**
 * Filled in by `lib/errorReporting.ts` at start-up when a DSN is configured.
 *
 * A function slot rather than an import so this module stays dependency-free and testable:
 * the logger is imported by everything, and it must not drag an error-reporting SDK into a
 * unit test that only wanted to check a message.
 */
type Reporter = (scope: string, message: string, fields?: LogFields) => void;

let reporter: Reporter | null = null;

export function setErrorReporter(fn: Reporter | null): void {
  reporter = fn;
}

function reportError(scope: string, message: string, fields?: LogFields): void {
  if (!reporter) return;
  try {
    reporter(scope, message, fields);
  } catch {
    // A failing reporter must never break the path that was already failing.
  }
}
