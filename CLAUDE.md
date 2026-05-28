# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Policy

**Never push to remote without explicit user request.**
Always commit locally when asked, but wait for a direct "push et" or equivalent instruction before running `git push`.

## Commands

This is a **pnpm + Turborepo monorepo**. Always run commands from the repo root; Turbo fans out to the right workspace automatically.

```bash
# Run all services concurrently
pnpm dev

# Run individual workspaces
pnpm dev:backend    # tsx watch → apps/backend/src/index.ts, port 3101
pnpm dev:web        # Vite dev server → apps/web-dashboard, port 5173
pnpm dev:ext        # WXT dev → apps/chrome-extension (loads into Chrome)

# Build
pnpm build          # full monorepo build (respects dependency order)
pnpm build:web      # web-dashboard only

# First-time setup (after cloning or changing package managers)
pnpm install
```

There are no automated tests configured in this project.

## Environment Setup

**Backend** — `apps/backend/.env` (copy from `apps/backend/.env.example`):
```
PORT=3101
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=<your key>          # optional; AI insights disabled if absent
MONGODB_URI=mongodb://localhost:27017/perfscope   # optional; history disabled if unavailable
JWT_SECRET=<secret>
NODE_ENV=development
```

**Web Dashboard** — `apps/web-dashboard/.env`:
```
VITE_BACKEND_URL=http://localhost:3101   # defaults to this if omitted
VITE_GOOGLE_CLIENT_ID=<oauth client id>
```

MongoDB is gracefully optional — the server starts and runs analysis even without it; only history persistence is skipped.

## Architecture

### Monorepo structure
```
perfscope/
├── pnpm-workspace.yaml
├── turbo.json
├── apps/
│   ├── backend/           (@perfscope/backend — Express + Socket.io + Lighthouse)
│   ├── web-dashboard/     (@perfscope/web-dashboard — Vite + React 19 + TypeScript)
│   └── chrome-extension/  (@perfscope/chrome-extension — WXT + React + Tailwind)
└── packages/
    └── shared/            (@perfscope/shared — common TS types + API client factory)
```

### Analysis pipeline (the core flow)

Analysis is driven entirely over **WebSocket**, not REST. The sequence:

1. Frontend calls `startAnalysis(url, callbacks)` → emits `analysis:start` via Socket.io.
2. Backend `socket/analysis.handler.ts` receives it, looks up saved sessions from both `Website` and `CompetitorSession` collections and auto-injects credentials if found (matching by URL prefix), then calls `lighthouseService.analyzeStreaming()` or `analyzeWithInjectedSession()`.
3. `LighthouseService` spawns **two parallel Worker threads** (one for `performance + accessibility`, one for `seo + best-practices`), each with its own Chrome instance (Puppeteer). Whichever finishes first emits `analysis:partial`, so the UI updates progressively.
4. Both workers resolve → results merged into a single `AnalysisResult`, enriched with AI insights via Gemini (`ai.service.ts`), then emitted as `analysis:complete`.
5. `HistoryService` saves a lightweight summary to MongoDB asynchronously (non-blocking).

Socket events (client → server): `analysis:start { url, projectId? }`, `analysis:cancel { analysisId }`, `auth-audit:start { sessionId, url, projectId?, context? }`.  
Socket events (server → client): `analysis:progress`, `analysis:partial`, `analysis:complete`, `analysis:error`.

The REST endpoint (`analyzer.routes.ts`) uses a single-Chrome, non-streaming path — it exists but the UI uses the WebSocket path exclusively.

### Auth-Audit flow

For auditing login-protected pages, there is a separate two-phase flow:

1. `POST /api/auth-audit/session` → backend launches a **visible** (non-headless) Puppeteer browser at the target URL and returns a `sessionId`. The user manually logs in.
2. Frontend polls `GET /api/auth-audit/session/:sessionId` until the user signals ready.
3. Frontend emits `auth-audit:start { sessionId, url, context? }` over the same Socket.io connection. Backend calls `extractSessionData()` to harvest cookies + localStorage from the live browser, injects them into the Lighthouse run, then **auto-persists** the session: if `context === 'competitor'` it upserts into `CompetitorSession`; otherwise it upserts into `Website`. The visible browser is left open for re-use.

Session state (live browser handles) lives in an in-memory Map in `services/authAuditSession.ts`. The `authAuditStore` (Zustand, persisted to localStorage) tracks UI state for this flow on the frontend.

### Compare feature

The compare page runs two independent analyses side-by-side. Each side uses a **dedicated, short-lived socket** created per-analysis in `features/compare/api/compareSocket.ts` — not the shared singleton from `api/socket.ts`. This prevents concurrent analyses from mixing up event listeners.

Results can be preloaded from the websites page via `comparePreloadStore` (`store/comparePreloadStore.ts`), which is a plain **module-level singleton** (not Zustand). `setComparePreload()` stores the pair; `consumeComparePreload()` reads and clears it in one call. The compare page consumes this on mount and falls back to fresh socket analyses if absent.

### Projects feature

The `projects` feature groups audits by website and route. A `projectId` can be passed to `analysis:start`; the backend tags the `History` entry with it. `features/projects/useProjectAudits.ts` fetches grouped audit history via `GET /api/projects/:id/audits`, organising results by `routePath` with trend detection (improving / regressing / stable).

### Backend layout (`backend/src/`)
- `app.ts` — Express + Socket.io wiring; all routes mounted under `/api`
- `config/index.ts` — single config object from env vars
- `controllers/` — route handler logic (thin layer; most business logic lives in `services/`)
- `socket/analysis.handler.ts` — WebSocket event handling; orchestrates standard, auth-audit, and session auto-injection pipelines
- `services/lighthouse.service.ts` — `LighthouseService` (EventEmitter); the main Chrome/Worker engine
- `services/lighthouse.worker.ts` — Worker thread entry point; one thread per audit category pair
- `services/ai.service.ts` — Gemini API calls for insights and per-resource advice
- `services/authAuditSession.ts` — in-memory session store; manages visible Puppeteer browser handles for auth-audit flow
- `services/*-parser.ts` — transform raw Lighthouse artifacts into typed structures (flame chart, heap memory, resource waterfall, interactions, CLS, dependencies)
- `models/` — Mongoose schemas: `User`, `Website`, `History`, `CompareHistory`, `CompetitorSession`
- `routes/` — REST endpoints for auth, website CRUD, history, compare history, auth-audit sessions, competitor sessions, analysis (legacy non-streaming)

> **Note:** The backend has both **Mongoose** (primary, used for all models) and **Prisma** (`@prisma/client`) as dependencies. Only Mongoose is actively wired up; Prisma is present but not yet integrated.

### Frontend layout (`frontend/src/`)
- `features/` — feature-sliced; each feature owns its components, hooks, and types
  - `analyzer/` — main analysis UI; `useAnalysis` hook owns all socket lifecycle and state
  - `compare/` — side-by-side comparison; each side gets its own dedicated socket via `api/compareSocket.ts`
  - `dashboard/` — `DashboardLayout` (sidebar + routing shell), website management
  - `history/` — audit history with evolution charts
  - `compare-history/` — saved comparison sessions
  - `projects/` — project-based audit dashboard grouped by route with trend tracking
  - `auth/` — login/register pages, Google OAuth button, `ProtectedRoute`
  - `landing/` — public landing page
- `store/` — Zustand stores: `authStore` (persisted to localStorage), `analysisStore` (last result in-memory), `prefetchStore`, `authAuditStore` (persisted); plus `comparePreloadStore` (plain module singleton, not Zustand)
- `api/socket.ts` — singleton Socket.io client; lazily created, attaches JWT from `authStore`; used only by the analyzer feature
- `api/client.ts` — Axios instance; base URL is `/api` (Vite proxies `/api/*` → `http://localhost:3101` in dev); attaches JWT via request interceptor
- `shared/components/ui/` — Shadcn-style Radix + Tailwind primitives
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

Path alias: `@/` resolves to `frontend/src/` throughout the frontend codebase.

### State management pattern

- `useAnalysis` hook is the single source of truth for an in-progress or completed analysis. It wraps the Zustand `analysisStore` (which persists the last result across route changes) and manages socket listeners.
- `bootstrap(result, url)` — loads a historical result into the analyzer view without re-running Lighthouse.
- `adoptRunning()` — attaches to an already-running socket analysis (e.g. when navigating back mid-analysis).

### Auth

Dual auth: email/password (bcrypt + JWT, 30-day expiry) and Google OAuth. The JWT is stored in Zustand (`authStore`) with `persist` middleware (localStorage). The Socket.io connection sends the token in `handshake.auth.token`; `analysis.handler.ts` extracts `userId` from it to tag history entries. REST routes use `requireAuth` middleware (`middleware/auth.middleware.ts`) which validates the `Authorization: Bearer <token>` header.

### Styling

Pure Tailwind with a custom CSS variable design system. Variables are defined in `frontend/src/index.css` under `:root` / `[data-theme="light"]` selectors and prefixed with `--ps-`. Inline styles using these vars are the norm for interactive color changes (hover states, active nav items). `ThemeProvider` manages the `data-theme` attribute on `<html>`.
