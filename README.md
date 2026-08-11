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
    └── cli/                @perfscope/cli — `perfscope` command-line auditing companion
```

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

MongoDB, `GEMINI_API_KEY`, and `CRUX_API_KEY` are all optional: without Mongo, analyses still run but history is not persisted; without the Gemini key, AI insights are disabled; without a Chrome UX Report key (enable the *Chrome UX Report API* in a Google Cloud project, then create an API key at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)), audits show lab data only and the real-user field panel stays hidden. `MONGODB_URI` and `JWT_SECRET` have dev defaults (`mongodb://localhost:27017/perfscope`, a dev-only secret). For Google OAuth in the dashboard, set `VITE_GOOGLE_CLIENT_ID` in `apps/web-dashboard/.env`.

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

**CI.** GitHub Actions (`.github/workflows/ci.yml`) runs on pushes and PRs to `main`: install → build all workspaces → lint (web dashboard) → test.
