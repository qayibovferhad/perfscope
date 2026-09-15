# Logs, errors and what a running PerfScope will tell you

Three things, in the order you reach for them: the log, the error report, and `/health`.

## Logs

Every line goes through `lib/logger.ts`. There are no `console.log` calls left in the
backend except two inside `lighthouse.worker.ts`, which must stay import-free.

```ts
log.info('Socket', 'analysis started', { url });
log.warn('Budgets', 'budget broken', { url: result.url, metrics });
log.error('AI', 'insights failed', { err });
```

**Two formats, one call site.** On a laptop it prints what it always printed — `[Socket]
analysis started` with the values beside it — because that is what a person reads all day.
With `LOG_FORMAT=json` (the container default) each line is one object:

```json
{"ts":"2026-09-14T19:26:39.366Z","level":"info","scope":"http","msg":"request",
 "requestId":"trace-abc-123","method":"GET","path":"/api/history/all","status":401,"ms":4}
```

`LOG_LEVEL` is `info` in a deployment and `debug` on a laptop. Debug adds the health checks
and every socket connect and disconnect.

**Fields, not interpolation**, wherever the value is a thing rather than prose: `{ url }`
stays queryable, `${url}` inside a sentence does not. Messages that were already sentences
stayed sentences — several of them explain *why* something is being skipped, and a field bag
cannot say that.

**warn and error go to stderr**, everything else to stdout, so a host can separate
"something happened" from "something is wrong" without parsing anything.

### The request id

Every request gets one — from the caller's `x-request-id` if it sent one, so a trace that
starts at a proxy stays one trace — and it comes back in the response header. It lives in an
`AsyncLocalStorage`, so **every line written while handling that request carries it**,
including lines from a service three calls deep or a promise that settles later. With a
hundred concurrent audits, that is the difference between a log you can read and a log you
can only grep.

```
$ docker logs perfscope-backend | grep '"requestId":"trace-abc-123"'
```

### Redaction

Field names matching `token|password|secret|cookie|authorization|apikey|jwt|session` are
replaced with `[redacted]`, at any depth. This is not hygiene theatre: the auth-audit flow
holds real login cookies for someone else's account, and one careless `log.debug('session',
'captured', session)` would write them to a disk that account's owner has never heard of.
Ordinary fields are left alone — redaction that ate the context would make the line useless
rather than safe.

## Error reporting

Set `SENTRY_DSN` and every `log.error` is also filed, tagged with the scope and the request
id. Leave it unset and nothing is sent anywhere; the log line is identical either way.

It is wired **to the logger**, not exposed as a second call, because a path that logs a
failure and forgets to report it is how an outage stays invisible. The SDK is imported
dynamically — it pulls in a large dependency tree, and an install without a DSN should not
pay for it at start-up.

`unhandledRejection` and `uncaughtException` go through the same path, and the process
flushes before exiting on the second one: without that, a crash reports nothing, because
`captureException` is asynchronous and the process is already gone.

What is deliberately **not** collected: traces (`tracesSampleRate: 0` — the audit pipeline's
spans are minutes long and its timing is measured properly by the product itself) and PII
(`sendDefaultPii: false`). What reaches Sentry is what reached the log, redaction included.

## `/health`

```json
{"status":"ok","uptime":1043,"database":"up","version":"main-abc1234"}
```

`database` is *reported*, never a 503: the app serves empty shapes without Mongo on purpose,
so an outage there is a degradation to describe, not a reason for an orchestrator to restart
a server that is working as designed. `version` is the image tag — see
[RELEASE.md](RELEASE.md), where it is how a deploy is told apart from a restart.

## What is still missing

No metrics endpoint. There is no counter for audits run, queue depth or Chrome launches, so
"how busy is it" can only be answered by reading logs. `services/auditQueue.ts` already
knows the numbers; exposing them as `/metrics` is the obvious next step and is not done.
