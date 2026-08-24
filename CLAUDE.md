# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Analyzer — read before touching the result shape

`docs/analyzer/PLAN.md` records the 2026-08-22 sprint that added four things to
`AnalysisResult`, each with the reasoning, the caps and the measurements: `previous`
(what moved since the last run of the same URL, attached *before* `analysis:complete`),
`AuditItem.category`/`group` (read from Lighthouse's own `auditRefs`/`categoryGroups`,
capped 15 **per category**), `AuditDetail.screenshot` (element crops, socket path only),
and `bundles` (the JavaScript treemap). Read the phase records before changing any of them
— several of the decisions look arbitrary and are not.

Three traps it documents that will cost time again: `getPreviousRun` must be given
`result.formFactor` or a mobile run is compared against a desktop one; Lighthouse reports
screenshot dimensions in *fractional* CSS pixels and Puppeteer throws on them; Lighthouse
audit descriptions are Markdown and end with a link.

`e2e/fixtures/inaccessible.html` is a page that fails on purpose in five accessibility
groups. The probes serve it themselves — reuse it rather than depending on a third-party
site staying broken.

## AI layer — read before touching anything AI

`docs/ai/HANDOFF.md` is the entry point: how the layer is wired, how to measure it, the
exact next step and the traps. `docs/ai/PLAN.md` is the six-phase plan it executes.
Written 2026-08-16 for a session starting with no memory of the one that produced them.
Do not start AI work without reading HANDOFF.md first — the biggest lever (audit
`details.items` are dropped in `lhr-transform.ts`) is not discoverable from the code alone.

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

```bash
pnpm test    # Vitest — shared (rating, formatters, forecast), backend (libs + parsers + lhr-transform), web-dashboard units
pnpm e2e     # Puppeteer smoke over 10 routes + a live Lighthouse run; servers must already be running
pnpm --filter @perfscope/web-dashboard lint   # ESLint, incl. FSD layer-boundary rules (0 errors is the bar)
```

CI (`.github/workflows/ci.yml`) runs build + lint + unit tests, and a separate `e2e` job with a Mongo service. Two CI-only gotchas are already encoded there: puppeteer's Chrome download fails on runners (skipped, system Chrome via `setup-chrome` + `PUPPETEER_EXECUTABLE_PATH`), and `turbo dev` hangs without a TTY (the job calls the package dev scripts directly).

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

Optional keys all degrade silently when unset — the feature simply turns off, it never crashes:
`GEMINI_API_KEY` (AI insights) · `GOOGLE_CLIENT_ID` (Google sign-in still works without it, but tokens are not checked against this app) · `CRUX_API_KEY` (real-user field data) · `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` (budget alert emails) · `MAX_CONCURRENT_AUDITS` (default 2) · `MONGODB_URI` (history persistence) · `VITE_GOOGLE_CLIENT_ID` (the login page hides Google auth without it).

`docker compose up -d` starts MongoDB only — the apps stay on the host because Lighthouse drives host Chrome.

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

Analysis is driven over **WebSocket**; the REST endpoint (`analyzer.routes.ts`) survives only because the Chrome extension and CLI login flow use it.

1. Frontend `startAnalysis(url, callbacks, { projectId, formFactor, precision })` → emits `analysis:start`.
2. `socket/analysis.handler.ts` **generates the analysisId itself** and forwards only progress/partials carrying that id — concurrent audits share the service's EventEmitter, so unfiltered listeners leak other users' progress. It also auto-injects a saved session when the target is **same-origin** with a stored one (prefix matching would leak a session to `example.com.evil.test`).
3. `LighthouseService` runs everything through `AuditQueue` (`MAX_CONCURRENT_AUDITS`, interactive beats background). Audits competing for CPU do not just run slower — they *report worse numbers*, so the cap is a correctness feature. Queued callers receive their position as progress.
4. Measurement:
   - `runs === 1` (Fast): two worker threads in parallel — `performance + accessibility` and `seo + best-practices`, each with its own Chrome. Whichever finishes first emits `analysis:partial`.
   - `runs > 1` (Precise, and always for nightly): static categories first, then N **isolated sequential** timed runs. `pickMedianRun` reports the median run *whole* — averaging metrics would describe a page load that never happened, and the waterfall/filmstrip must match the score beside them. Spread is reported as `MeasurementQuality`.
5. `lhr-transform.ts` merges the LHRs and runs every parser; the result is enriched and persisted by `auditPipeline.ts` — the one choke point every entry path shares: `enrichWithAi` → `persistAudit` → `checkBudgets`.

Socket events (client → server): `analysis:start { url, projectId?, formFactor?, precision? }`, `analysis:cancel { analysisId }`, `auth-audit:start { sessionId, url, projectId?, context?, formFactor? }`.
Socket events (server → client): `analysis:progress`, `analysis:partial`, `analysis:complete`, `analysis:error`.

### Budgets, alerts and sharing

- **Budgets** live on `Website.budgets` (min performance score, max LCP/TBT/CLS, `webhookUrl`, `alertEmail`) and are checked in `budget.service.ts` for every persisted audit. A breach is recorded on the site (badge on the websites page) and pushed to the webhook — `hooks.slack.com` gets Slack's `{text}` envelope, Discord `{content}`, anything else the full JSON payload — plus an email when SMTP is configured. A later clean audit of the same URL clears the breach; all-zero failed runs never count.
- **Share links**: `POST /api/history/:id/share` mints a 32-hex token, `GET /api/public/report/:token` serves the stored result unauthenticated, `/report/:token` renders it read-only.
- **Field data**: `crux.service.ts` queries the Chrome UX Report (URL level, falling back to origin) so real-user p75s sit next to the lab numbers.

### Hardening (production only)

`GET /health` answers `{ status, uptime, database, version }` — the database is *reported*,
never a 503, because the app serves empty shapes without Mongo on purpose. `helmet` is
mounted with `crossOriginResourcePolicy: 'cross-origin'`: its `same-origin` default would
block `/rum.js` on every site that installed the snippet. `compression` sits above the
routers because a stored audit result is hundreds of KB.

`lib/ssrf.ts` refuses any URL that **resolves** into the server's own network — audit
targets, the auth-audit browser, alert webhooks and sitemap scans. It is off in development
(auditing `http://localhost:5173` is a first-class use) and on when `NODE_ENV=production`;
`ALLOW_PRIVATE_TARGETS=true` turns it off again for an intranet install.

### Dashboard window

`/dashboard` asks for a window either as `?days=` (the presets) or `?from=&to=` (the date
picker). Both are resolved by **shared `resolveOverviewRange`** — the client labels the page
with it, the server turns it into a Mongo range — so the tiles and the charts can never name
a different window from the one they counted. Days are `YYYY-MM-DD` strings, UTC, because
History buckets by UTC day. The picker is `shared/ui/date-range-picker.tsx` (from scratch,
portalled); the site filter is a Radix `Select` and needs a sentinel value for "all sites"
because Radix reads `''` as nothing-selected.

### Auth-Audit flow

For auditing login-protected pages, there is a separate two-phase flow:

1. `POST /api/auth-audit/session` → backend launches a **visible** (non-headless) Puppeteer browser at the target URL and returns a `sessionId`. The user manually logs in.
2. Frontend polls `GET /api/auth-audit/session/:sessionId` until the user signals ready.
3. Frontend emits `auth-audit:start { sessionId, url, context? }` over the same Socket.io connection. Backend calls `extractSessionData()` to harvest cookies + localStorage from the live browser, injects them into the Lighthouse run, then **auto-persists** the session: if `context === 'competitor'` it upserts into `CompetitorSession`; otherwise it upserts into `Website`. The visible browser is left open for re-use.

If a run that injected a session still lands on a login page, `SessionExpiredError` is thrown: the dead session is dropped, the site is flagged `requiresLogin`, and **nothing is persisted** — a stored 0-score audit of a login screen would poison the site's history and budgets.

Session state (live browser handles) lives in an in-memory Map in `services/authAuditSession.ts`. The `authAuditStore` (Zustand, persisted to localStorage) tracks UI state for this flow on the frontend.

### Compare feature

The compare page runs two independent analyses side-by-side. Each side uses a **dedicated, short-lived socket** created per-analysis in `features/compare/api/compareSocket.ts` — not the shared singleton from `api/socket.ts`. This prevents concurrent analyses from mixing up event listeners.

Results can be preloaded from the websites page via `comparePreloadStore` (`features/compare/model/comparePreloadStore.ts`), which is a plain **module-level singleton** (not Zustand). `setComparePreload()` stores the pair; `consumeComparePreload()` reads and clears it in one call. The compare page consumes this on mount and falls back to fresh socket analyses if absent.

### Projects feature

The `projects` feature groups audits by website and route. A `projectId` can be passed to `analysis:start`; the backend tags the `History` entry with it. `features/projects/model/useProjectAudits.ts` fetches grouped audit history via `GET /api/projects/:id/audits`, organising results by `routePath` with trend detection (improving / regressing / stable).

### Backend layout (`backend/src/`)
- `app.ts` — Express + Socket.io wiring; all routes mounted under `/api`
- `config/index.ts` — single config object from env vars
- `controllers/` — route handler logic (thin layer; most business logic lives in `services/`)
- `socket/analysis.handler.ts` — WebSocket event handling; orchestrates standard, auth-audit, and session auto-injection pipelines
- `services/lighthouse.service.ts` — `LighthouseService` (EventEmitter); orchestration only (~370 lines) — Chrome/Worker lifecycle, queueing, run iteration
- `services/lighthouse.worker.ts` — Worker thread entry point. **Must stay self-contained**: tsx's `.js`→`.ts` remap does not apply inside Worker threads, so a relative import here fails at runtime only. Also crops the failing-element screenshots (`captureElements`, static group only) out of Lighthouse's full-page capture, then deletes that capture before posting the LHR back
- `services/lhr-transform.ts` — LHR → `AnalysisResult` (scores, audits, auth-redirect detection); calls the parsers
- `services/*-parser.ts` — typed structures from raw artifacts: resource waterfall, timeline/filmstrip, CLS, dependencies, flame chart, heap memory, interactions, third parties, JS bundles (`bundle-parser.ts`, from `script-treemap-data`)
- `services/auditPipeline.ts` — `attachPreviousRun` + `enrichWithAi` + `persistAudit` (+ budget check); used by the socket handler, nightly audits and the REST controller alike. Anything written onto `result` here is stored by `persistAudit`, which is what makes the live view, a reopened history row, the public report and the CLI agree without any of them re-deriving it
- `services/auditQueue.ts` — concurrency cap + priority for every audit
- `services/budget.service.ts`, `mailer.service.ts`, `crux.service.ts`, `ai.service.ts`, `authAuditSession.ts`
- `lib/` — `url.ts` (`isValidUrl`, `hostOf`, `sameOrigin`, `normalizeUrl`, `escapeRegex`, `hostPrefixRegex`), `ssrf.ts` (private-network guard — **production only**, see below), `medianRun.ts`, `chrome.ts` (launch flags), `errors.ts`
- `models/` — Mongoose schemas: `User`, `Website`, `History`, `CompareHistory`, `CompetitorSession`
- `routes/` — auth, website CRUD + budgets, history + share links, public report, compare history, auth-audit sessions, competitor sessions, CrUX, CLI auth, legacy analyze

### Frontend layout (`apps/web-dashboard/src/`) — Feature-Sliced Design

Six FSD layers; imports flow strictly downward (`app` → `pages` → `widgets` → `features` → `entities` → `shared`). Slices use `ui/` (components), `model/` (hooks + Zustand stores), `api/` (slice network code), `lib/` (helpers) segments.

- `app/` — `App.tsx` (routes), `main.tsx` (providers + token wiring), `ErrorBoundary`, `styles/index.css`
- `pages/` — route-level pages; page-local components live in the page's own `ui/` (e.g. `pages/websites/ui/WebsiteCard.tsx`)
- `widgets/` — self-contained blocks: `dashboard-layout` (sidebar shell), `analyzer-results`, `analyzer-header`, `history-websites-overview`, `cross-website-picker`, `footer`
- `features/` — user scenarios:
  - `analyzer/` — analysis UI; `model/useAnalysis` owns socket lifecycle, `model/analysisStore` (Zustand) persists last result across routes
  - `compare/` — side-by-side comparison; each side gets a dedicated short-lived socket via `api/compareSocket.ts`; `model/comparePreloadStore` (plain module singleton, not Zustand)
  - `auth-audit/` — login-wall session capture; has an `index.ts` public API because `compare` and `websites` embed its modals (the one sanctioned cross-feature import)
  - `history/`, `compare-history/`, `projects/`, `websites/`, `automation/`, `auth/`, `extension/`, `subscribe/`
- `entities/` — business objects; types re-exported from `@perfscope/shared` plus entity-level hooks/UI:
  - `analysis/` — types, `api/analysisSocket.ts` (startAnalysis/joinAnalysis/emitAuthAuditStart over the shared socket), `model/prefetchStore`, `ui/` (ScoreCard, MetricsGrid, AuditList, ProgressStepper)
  - `website/` — types, `getHostname`, `model/useWebsites` (React Query CRUD hook used app-wide)
  - `history/` — types, `model/useHistory` (+ useAllHistory/useDeleteAudit/fetchHistoryResult), `lib/hasResult`
  - `user/` — `AuthUser` type
- `shared/` — domain-agnostic: `api/client.ts` (Axios, JWT interceptor), `api/socket.ts` (raw Socket.io singleton — no analysis knowledge), `lib/utils.ts` (`cn()`), `ui/` (Radix + Tailwind primitives; complex ones as folders with barrels: `modal/`, `panel/`, `theme/`)

Path alias: `@/` resolves to `apps/web-dashboard/src/`. Entities expose `index.ts` barrels — import `@/entities/<name>`, not deep paths. Features are imported by segment path (only `auth-audit` and `subscribe` have barrels).

### State management pattern

- `useAnalysis` hook is the single source of truth for an in-progress or completed analysis. It wraps the Zustand `analysisStore` (which persists the last result across route changes) and manages socket listeners.
- `bootstrap(result, url)` — loads a historical result into the analyzer view without re-running Lighthouse.
- `adoptRunning()` — attaches to an already-running socket analysis (e.g. when navigating back mid-analysis).

### Auth

Dual auth: email/password (bcrypt) and Google OAuth. Google is not a browser-only flow: the
page sends Google's access token to `POST /api/auth/google`, which verifies it with Google
(audience must match `GOOGLE_CLIENT_ID`, address must be verified), upserts the `User` **by
email** so a password account and a Google sign-in are one account, and returns the same
`AuthResponse` as `/auth/login`.

**Sessions are a pair** (`services/authTokens.service.ts`): a 30-minute access JWT — still
verified with no database read, so `requireAuth` is unchanged — plus a 30-day opaque refresh
token, stored **hashed** in `RefreshToken` and **rotated on every use**. Presenting a spent
refresh token revokes its whole family: it is either a replay or a copy someone else holds,
and there is no way to tell. `POST /auth/refresh` renews, `/auth/logout` ends one session,
`/auth/logout-all` ends the rest (Settings → Signed-in devices); a password change or reset
ends them too. An already-issued access token cannot be un-issued, so revocation takes effect
within 30 minutes — deliberate, in exchange for no per-request database read.

Every client renews rather than expiring: the dashboard's axios interceptor refreshes once on
a 401 and replays the request (single-flight — concurrent 401s must not each spend the
rotating token), `packages/shared`'s `createApiClient` does the same for the extension, and
the CLI checks the JWT's `exp` locally before each command (`packages/cli/src/session.js`;
CI can supply `PERFSCOPE_REFRESH_TOKEN`). `POST /auth/cli/complete` mints the CLI a session of
its own rather than copying the browser's.

Forgot-password lives in `services/passwordReset.service.ts`: hashed single-use token, one
hour, and the endpoint answers identically for a real address, a Google-only account and an
unknown one — it is the one form anyone can post to. With no SMTP configured the link is
logged (never in production), which is what makes the flow testable locally.

The pair is stored in Zustand (`authStore`, persisted to localStorage). The Socket.io
connection sends the access token in `handshake.auth.token`; `analysis.handler.ts` extracts
`userId` from it to tag history entries. REST routes use `requireAuth`
(`middleware/auth.middleware.ts`), which validates the `Authorization: Bearer <token>` header.

### Styling

Pure Tailwind with a custom CSS variable design system. Variables are defined in `apps/web-dashboard/src/app/styles/index.css` under `:root` / `[data-theme="light"]` selectors and prefixed with `--ps-`. Inline styles using these vars are the norm for interactive color changes (hover states, active nav items). `ThemeProvider` manages the `data-theme` attribute on `<html>`.
