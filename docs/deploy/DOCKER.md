# Running PerfScope in containers

Two images and a MongoDB, wired by `docker-compose.prod.yml`:

| Service | Image | What it is |
|---|---|---|
| `web` | `apps/web-dashboard/Dockerfile` | the built Vite bundle on nginx, which also **proxies** `/api`, `/socket.io`, `/rum.js` and `/health` to the backend |
| `backend` | `apps/backend/Dockerfile` | Express + Socket.io + Lighthouse, with a Chromium inside it |
| `mongo` | `mongo:7` | history, websites, budgets, flows — unpublished, reachable only on the compose network |

```bash
cp .env.docker.example .env.docker      # JWT_SECRET is required; everything else optional
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d --build
open http://localhost:8080
```

`--env-file` is not optional. Compose interpolates `${...}` from its own environment and
from `.env` only — a service's `env_file:` reaches the container but never the file you are
reading — so without the flag `JWT_SECRET` resolves empty and the stack stops with the
message in the compose file rather than signing tokens with nothing.

`docker-compose.yml` (no `-f`) is unchanged and still MongoDB only, for `pnpm dev` on the
host. The two stacks carry different project names and container names on purpose: sharing
them meant starting the deployment silently recreated the development MongoDB without its
published `27017`, and a host `pnpm dev` lost its database.

## What the deployment does differently

**It refuses to audit itself.** `NODE_ENV=production` turns on the SSRF guard, so any URL
that resolves into the server's own network — `localhost`, `10.x`, `169.254.169.254` — is
rejected before a browser opens. That is the point of the guard, and it is why
`http://localhost:8080` is not auditable from inside this stack. An install that
deliberately audits an intranet sets `ALLOW_PRIVATE_TARGETS=true`.

**Login-protected audits do not work here.** The auth-audit flow opens a *visible* Chrome
for a person to log into, and a container has no display; the API answers 503 saying so.
Running that Chrome under a virtual display would be worse — a window nobody can type into
captures no session, and the audit then lands on the login page. Use a desktop install for
that flow.

**One backend is the supported shape; more is possible with sticky sessions.** Audit
throughput scales with `MAX_CONCURRENT_AUDITS` and CPU, not replicas — and that knob is a
measurement setting, not just a resource limit: audits that compete for CPU report worse
numbers than the page deserves. For availability rather than throughput, what a second
replica meets (checked 2026-09-15):

| State | Behind two replicas |
|---|---|
| Scheduled jobs (nightly audits, flows, digests, field budgets) | **Safe.** Each tick is claimed in `CronLease` (`lib/cronLease.ts`); only the instance whose insert lands runs it. |
| CLI login codes | **Safe.** Stored in `CliAuthCode`; memory is only the no-database fallback. |
| Socket.io (live audits, flows) | **Needs sticky sessions.** Clients start on long-polling and upgrade, and an audit reports to the socket on the instance running it — route by client (e.g. nginx `ip_hash`). |
| RUM rate limiter | Per instance, so the effective limit is N × 600 beacons/min per key. |
| Team membership cache | Per instance, 15 s: a removal made on one replica takes up to 15 s on the other. |
| AI prompt, CrUX and RUM-key caches | Per instance; a miss costs a call, never a wrong answer. |
| Auth-audit browser handles | Per instance, and the flow is unavailable in a container anyway (above). |

## Configuration is runtime, not build-time

The dashboard image carries no `VITE_*` values. `docker/40-runtime-env.sh` writes
`/env.js` at container start from the environment, and `src/shared/config/runtimeEnv.ts`
reads `window.__PERFSCOPE_ENV__` before falling back to the build vars:

```
window.__PERFSCOPE_ENV__  →  import.meta.env.VITE_*  →  default
```

So one image serves any install. Two keys are read: `BACKEND_URL` (leave **empty** for the
normal setup — nginx proxies to the backend on the same origin) and `GOOGLE_CLIENT_ID`
(empty hides Google sign-in). `/env.js` is served `no-store`; a cached copy would keep a
previous deploy's backend URL.

`PUBLIC_URL` is the address people type. It becomes the backend's `CLIENT_URL`, which is
its CORS origin and the origin the Socket.io handshake is checked against — so it must be
the public URL, not `http://backend:3101`.

## Why Chromium comes from Debian

The backend image installs `chromium` with apt and points Puppeteer at it
(`PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`, `PUPPETEER_SKIP_DOWNLOAD=true`) — the same
mechanism CI already uses with `setup-chrome`. apt resolves the sixty-odd shared libraries
a headless Chrome needs, which Puppeteer's bare download does not, and it keeps the image
multi-arch. `CHROME_ARGS` already carries `--no-sandbox` and `--disable-dev-shm-usage`,
which is why the container needs neither a raised `shm_size` nor a privileged profile, and
why the process runs as `node` rather than root.

`dumb-init` is PID 1 because every audit spawns Chrome processes. `lib/chromeReaper.ts`
kills the browsers it knows about, but an orphan from a crashed worker has no parent left
to wait on it, and a few hundred audits of those fill the container with zombies.

## Verified 2026-09-13

Built and run on this machine, everything driven through nginx on `:8080`:

```
/_healthz                 → ok
/health (proxied)         → {"status":"ok","database":"up","version":"1.0.0"}
/history (SPA fallback)   → 200 text/html
/assets/index-*.js        → immutable 1y, gzip 232 kB → 78 kB
/env.js                   → no-store, one Cache-Control header
register + refresh        → 201, rotation 200
private target            → 400 "resolves to a private or local address"
socket                    → connected over websocket (not polling)
analysis of example.com   → complete in 14.4s, perf 100 / a11y 100 / seo 80 / bp 96,
                            8 filmstrip frames, 101 flame events, 1 waterfall request
history/all               → 200, the run persisted to the container's Mongo
auth-audit session        → 503 with the no-display explanation, server still up
```

Image sizes: backend 1.25 GB (Chromium is most of it), web 51 MB.

## Still open

A **host**: a domain, TLS and somewhere to run. The registry and the deploy job are
[RELEASE.md](RELEASE.md), logs/metrics/errors are [OBSERVABILITY.md](OBSERVABILITY.md) and
dumps are [BACKUP.md](BACKUP.md).

**Indexes on a fresh database** were missing until 2026-09-15: with `bufferCommands` off,
Mongoose's own index build ran before the connection existed and failed silently, so this
stack's first Mongo had none — no unique email, no TTLs. `connectDatabase` now builds them
after connecting, and CI's `images` job asserts they exist.
