# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Policy

**Never push to remote without explicit user request.**
Always commit locally when asked, but wait for a direct "push et" or equivalent instruction before running `git push`.

## Commands

This is an npm workspaces monorepo (`backend` + `frontend`). Always run npm commands from the repo root unless targeting a specific workspace.

```bash
# Run both services concurrently (recommended for development)
npm run dev

# Run individually
npm run dev:backend     # tsx watch on backend/src/index.ts, port 3101
npm run dev:frontend    # Vite dev server, port 5173

# Build
npm run build:backend   # tsc → backend/dist/
npm run build:frontend  # tsc -b && vite build

# Lint (frontend only — no backend linter configured)
npm run lint --workspace=frontend
```

There are no automated tests configured in this project.

## Environment Setup

**Backend** — `backend/.env` (copy from `backend/.env.example`):
```
PORT=3101
CLIENT_URL=http://localhost:5173
GEMINI_API_KEY=<your key>          # optional; AI insights disabled if absent
MONGODB_URI=mongodb://localhost:27017/perfscope   # optional; history disabled if unavailable
JWT_SECRET=<secret>
NODE_ENV=development
```

**Frontend** — `frontend/.env`:
```
VITE_BACKEND_URL=http://localhost:3101   # defaults to this if omitted
VITE_GOOGLE_CLIENT_ID=<oauth client id>
```

MongoDB is gracefully optional — the server starts and runs analysis even without it; only history persistence is skipped.

## Architecture

### Monorepo structure
```
perfscope/
├── backend/   (@perfscope/backend — Express + Socket.io + Lighthouse)
└── frontend/  (Vite + React 19 + TypeScript)
```

### Analysis pipeline (the core flow)

Analysis is driven entirely over **WebSocket**, not REST. The sequence:

1. Frontend calls `startAnalysis(url, callbacks)` → emits `analysis:start` via Socket.io.
2. Backend `analysis.handler.ts` receives it, calls `lighthouseService.analyzeStreaming()`.
3. `LighthouseService` spawns **two parallel Worker threads** (one for `performance + accessibility`, one for `seo + best-practices`), each with its own Chrome instance (Puppeteer). Whichever finishes first emits `analysis:partial` back to the socket, so the UI updates progressively.
4. Both workers resolve → results are merged into a single `AnalysisResult`, enriched with AI insights via Gemini (`ai.service.ts`), then emitted as `analysis:complete`.
5. `HistoryService` saves a lightweight summary to MongoDB asynchronously (non-blocking).

The REST endpoint (`analyzer.routes.ts`) uses a single-Chrome, non-streaming path — it exists but the UI uses the WebSocket path exclusively.

### Backend layout (`backend/src/`)
- `app.ts` — Express + Socket.io wiring; all routes mounted under `/api`
- `config/index.ts` — single config object from env vars
- `socket/analysis.handler.ts` — WebSocket event handling, orchestrates the full pipeline
- `services/lighthouse.service.ts` — `LighthouseService` (EventEmitter); the main Chrome/Worker engine
- `services/lighthouse.worker.ts` — Worker thread entry point; runs in a separate thread per audit
- `services/ai.service.ts` — Gemini API calls for insights and per-resource advice
- `services/*-parser.ts` — Transform raw Lighthouse artifacts into typed structures (flame chart, heap memory, resource waterfall, interactions, CLS, dependencies)
- `models/` — Mongoose schemas: `User`, `Website`, `History`, `CompareHistory`
- `routes/` — REST endpoints for auth (JWT + bcrypt), website CRUD, history queries, compare history

### Frontend layout (`frontend/src/`)
- `features/` — feature-sliced; each feature owns its components, hooks, and types
  - `analyzer/` — main analysis UI; `useAnalysis` hook owns all socket lifecycle and state
  - `compare/` — side-by-side comparison with its own socket flow (`compareSocket.ts`)
  - `dashboard/` — `DashboardLayout` (sidebar + routing shell), website management
  - `history/` — audit history with evolution charts
  - `compare-history/` — saved comparison sessions
  - `auth/` — login/register pages, Google OAuth button, `ProtectedRoute`
- `store/` — Zustand stores: `authStore` (persisted), `analysisStore` (last result in-memory), `prefetchStore`
- `api/socket.ts` — singleton Socket.io client; lazily created, attaches JWT from `authStore`
- `shared/components/ui/` — Shadcn-style Radix + Tailwind primitives
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

### State management pattern

- `useAnalysis` hook is the single source of truth for an in-progress or completed analysis. It wraps the Zustand `analysisStore` (which persists the last result across route changes) and manages socket listeners.
- `bootstrap(result, url)` — loads a historical result into the analyzer view without re-running Lighthouse.
- `adoptRunning()` — attaches to an already-running socket analysis (e.g. when navigating back mid-analysis).

### Auth

Dual auth: email/password (bcrypt + JWT, 30-day expiry) and Google OAuth. The JWT is stored in Zustand (`authStore`) with `persist` middleware (localStorage). The Socket.io connection sends the token in `handshake.auth.token`; `analysis.handler.ts` extracts `userId` from it to tag history entries.

### Styling

Pure Tailwind with a custom CSS variable design system. Variables are defined in `frontend/src/index.css` under `:root` / `[data-theme="light"]` selectors and prefixed with `--ps-`. Inline styles using these vars are the norm for interactive color changes (hover states, active nav items). `ThemeProvider` manages the `data-theme` attribute on `<html>`.
