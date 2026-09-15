# PerfScope

[![CI](https://github.com/qayibovferhad/perfscope/actions/workflows/ci.yml/badge.svg)](https://github.com/qayibovferhad/perfscope/actions/workflows/ci.yml)

Lighthouse-based web performance analyzer. A Node backend runs audits in parallel worker threads (each with its own Chrome instance) and streams results over WebSocket to a React dashboard. Also ships a Chrome extension and a CLI companion.

## What's inside

pnpm + Turborepo monorepo:

```
perfscope/
├── apps/
│   ├── backend/            @perfscope/backend — Express + Socket.io + Lighthouse (Puppeteer)
│   ├── web-dashboard/      @perfscope/web-dashboard — Vite + React 19 + TypeScript (FSD)
│   └── chrome-extension/   @perfscope/chrome-extension — WXT + React + Tailwind
└── packages/
    ├── shared/             @perfscope/shared — common TS types, API client factory, design tokens
    ├── cli/                @perfscope/cli — `perfscope` command-line auditing companion
    └── action/             GitHub Action — run a budget on every PR and report it there
```

## On every pull request

```yaml
- uses: qayibovferhad/perfscope/packages/action@main
  with:
    url: https://staging.example.com
    budget: performance=80,lcp=2500,cls=0.1
    refresh-token: ${{ secrets.PERFSCOPE_REFRESH_TOKEN }}
```

One comment that keeps itself up to date, a check run on the commit, and a build that goes
red when a page slows down — with each metric's move since the previous audit of the same
URL beside it. See [packages/action](packages/action) for the inputs and the caveats.

## Quickstart

Prerequisites: Node 22, pnpm, Google Chrome (Lighthouse runs on host Chrome), Docker (for MongoDB).

```bash
docker compose up -d                                  # start MongoDB (infra only — apps run on host)
cp apps/backend/.env.example apps/backend/.env        # set GEMINI_API_KEY for AI insights (optional)
pnpm install
pnpm dev
```

- Backend: http://localhost:3101
- Web dashboard: http://localhost:5173

### Or run the whole thing in containers

```bash
cp .env.docker.example .env.docker       # JWT_SECRET is required; everything else optional
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d --build
open http://localhost:8080
```

Two images — the dashboard on nginx (which also proxies `/api`, `/socket.io` and `/rum.js`
to the backend, so the bundle carries no origin of its own) and the backend with a Chromium
inside it. Configuration is read at container start rather than baked in, so one image
serves any install. Two things work differently there and are meant to: the deployment
refuses to audit a URL that resolves into its own network (the SSRF guard, on with
`NODE_ENV=production`), and the login-protected audit flow needs a desktop to log in on.
See [docs/deploy/DOCKER.md](docs/deploy/DOCKER.md).

On a server, run the published images instead of building them: pushes to `main` and `v*`
tags publish `ghcr.io/<owner>/perfscope-backend` and `-web`, and
`docker-compose.deploy.yml` pulls them — no checkout, no Node, no pnpm on the host. Each
image is stamped with its tag and reports it at `/health`, which is what distinguishes a
deploy from a restart. See [docs/deploy/RELEASE.md](docs/deploy/RELEASE.md). Running it is
[OBSERVABILITY.md](docs/deploy/OBSERVABILITY.md) (structured logs with a request id,
optional Sentry, `/health`) and [BACKUP.md](docs/deploy/BACKUP.md) (a daily dump, and what
it does not protect you from).

MongoDB, `GEMINI_API_KEY`, and `CRUX_API_KEY` are all optional: without Mongo, analyses still run but history is not persisted; without the Gemini key, AI insights are disabled; without a Chrome UX Report key (enable the *Chrome UX Report API* in a Google Cloud project, then create an API key at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)), audits show lab data only and the real-user field panel stays hidden. `MONGODB_URI` and `JWT_SECRET` have dev defaults (`mongodb://localhost:27017/perfscope`, a dev-only secret). For Google OAuth in the dashboard, set `VITE_GOOGLE_CLIENT_ID` in `apps/web-dashboard/.env`.

## A badge for your README

Share any stored report, then point shields.io at the badge endpoint that comes with it:

```md
![PerfScope](https://img.shields.io/endpoint?url=https://your-host/api/public/badge/<share-token>)
```

`?category=accessibility|seo|bestPractices` badges one of the others. The colour follows the
same 90/50 bands the app draws with, and revoking the share link turns the badge off.

## API reference

[docs/api/README.md](docs/api/README.md) — every route, what it is for, and whether it needs
a token, kept in step with the code by a test that fails when a route is added or moved
without the table changing.

## Scripts

Run everything from the repo root — Turborepo fans out to the right workspace.

| Script             | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | All workspaces in watch mode                        |
| `pnpm dev:backend` | Backend only (tsx watch, port 3101)                 |
| `pnpm dev:web`     | Web dashboard only (Vite, port 5173)                |
| `pnpm dev:ext`     | Chrome extension only (WXT, loads into Chrome)      |
| `pnpm build`       | Full monorepo build (dependency-ordered)            |
| `pnpm build:web`   | Web dashboard build only                            |
| `pnpm lint`        | Lint all workspaces                                 |
| `pnpm test`        | Run tests (Vitest) across workspaces                |

## Architecture

**Analysis pipeline (WebSocket, not REST).** The dashboard emits `analysis:start` over Socket.io. The backend spawns **two parallel worker threads** — one for `performance + accessibility`, one for `seo + best-practices` — each driving its own Chrome instance. Whichever finishes first emits `analysis:partial` so the UI updates progressively; the merged result (enriched with Gemini AI insights when configured) arrives as `analysis:complete`, and a summary is persisted to MongoDB asynchronously.

**Auth-audit flow.** For login-protected pages, the backend opens a **visible** Puppeteer browser; you log in manually, then the backend harvests cookies + localStorage from the live session and injects them into the Lighthouse run. Captured sessions are persisted and auto-injected on later runs of the same site.

**Design tokens.** The `--ld-*` CSS variable system lives in `@perfscope/shared` (`src/styles/tokens.css`) as the single source of truth, consumed by both the web dashboard and the Chrome extension.

**Frontend.** The web dashboard follows Feature-Sliced Design (`app / pages / widgets / features / entities / shared`).

**CI.** GitHub Actions (`.github/workflows/ci.yml`) runs on pushes and PRs to `main`: build → typecheck → lint → unit tests; an `e2e` job that audits the dashboard through PerfScope's own GitHub Action; and an `images` job that builds both Docker images and smoke-tests the stack through nginx. A separate `release.yml` publishes the images to GHCR and can deploy them over SSH once a host is configured.
