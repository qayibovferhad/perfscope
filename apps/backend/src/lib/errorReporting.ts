import { config } from '../config/index.js';
import { log, setErrorReporter, currentRequestId } from './logger.js';

/**
 * Error reporting, off unless `SENTRY_DSN` is set — the same bargain every optional key in
 * this server makes: configure it and the feature appears, leave it and nothing changes.
 *
 * Wired to `log.error` rather than exposed as a second call, so there is no way to log a
 * failure and forget to report it. What reaches Sentry is what reached the log, redaction
 * included, plus the request id: an issue and the surrounding log lines can then be lined
 * up by the same string.
 *
 * The SDK is imported **dynamically**. It pulls in OpenTelemetry and a large dependency
 * tree, and an install with no DSN — every development machine, and the default
 * deployment — should not pay for it at start-up.
 */

let initialised = false;

export async function initErrorReporting(): Promise<void> {
  if (initialised || !config.sentryDsn) return;

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.nodeEnv,
      release: config.appVersion,
      // Errors only. Tracing would sample the audit pipeline, whose spans are minutes long
      // and whose timing is measured properly elsewhere — by the product itself.
      tracesSampleRate: 0,
      // The server holds captured login sessions and bearer tokens. Nothing may be
      // collected that was not deliberately passed to a log field, which is already
      // redacted on the way in.
      sendDefaultPii: false,
    });

    setErrorReporter((scope, message, fields) => {
      const requestId = currentRequestId();
      const err = fields?.['err'];
      // `exactOptionalPropertyTypes` is on: an `extra: undefined` is not the same as no
      // `extra` at all, and the SDK's types say so.
      const context = {
        tags: { scope, ...(requestId ? { requestId } : {}) },
        ...(fields ? { extra: fields as Record<string, unknown> } : {}),
      };
      // `err` is the real failure when there is one; the message alone is all there is
      // when a code path logged a condition rather than a throw.
      if (err instanceof Error) Sentry.captureException(err, context);
      else                      Sentry.captureMessage(`[${scope}] ${message}`, { ...context, level: 'error' });
    });

    initialised = true;
    log.info('Sentry', 'error reporting enabled', { environment: config.nodeEnv, release: config.appVersion });
  } catch (err) {
    // A broken DSN or a missing optional dependency must not stop the server booting.
    log.warn('Sentry', 'error reporting could not be initialised', { err });
  }
}

/**
 * Give the reporter a moment to send what is queued, on the way down.
 *
 * Without this a crash reports nothing: `captureException` is asynchronous, and the
 * process exits before the request leaves.
 */
export async function flushErrorReporting(timeoutMs = 2_000): Promise<void> {
  if (!initialised) return;
  try {
    const Sentry = await import('@sentry/node');
    await Sentry.flush(timeoutMs);
  } catch {
    // Nothing useful to do while shutting down.
  }
}

/** Only for tests: forget the reporter so one test's SDK does not leak into the next. */
export function resetErrorReporting(): void {
  initialised = false;
  setErrorReporter(null);
}
