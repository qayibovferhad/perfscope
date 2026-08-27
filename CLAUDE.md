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
pnpm test        # 398 unit tests across 5 workspaces — vitest in shared/backend/web-dashboard,
                 # node:test in cli and action. `probes/` is deliberately NOT part of this.
pnpm e2e         # Puppeteer smoke over 10 routes + a live Lighthouse run; servers must already be running
pnpm typecheck   # every workspace, including the ones whose build is not tsc
pnpm lint        # every workspace. 0 errors is the bar; ~35 warnings are deliberate

# Hand-run, minutes each, needing a real Chrome / Gemini key / Mongo:
node e2e/<name>.probe.mjs                     # browser-level probes
cd apps/backend && npx tsx probes/<name>.mts  # service-level probes
```

CI (`.github/workflows/ci.yml`) runs build + typecheck + lint + unit tests, and a separate `e2e` job with a Mongo service that also audits the dashboard through PerfScope's own GitHub Action. Two CI-only gotchas are already encoded there: puppeteer's Chrome download fails on runners (skipped, system Chrome via `setup-chrome` + `PUPPETEER_EXECUTABLE_PATH`), and `turbo dev` hangs without a TTY (the job calls the package dev scripts directly).

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
    ├── shared/            (@perfscope/shared — common TS types + API client factory)
    ├── cli/               (@perfscope/cli — the `perfscope` command; plain JS, published standalone)
    └── action/            (GitHub Action — runs `perfscope ci` and reports it on the PR)
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

### CI and the GitHub Action

`packages/action/` is a **composite** action: it runs `perfscope ci --json` as its own step
(so the CLI's output, annotations and exit code read exactly as they do locally) and then
`run.mjs`, which posts one sticky PR comment per audited URL and a check run. Three things
there are not obvious and are covered by tests: the check goes on the PR's **head sha**, not
the merge commit `GITHUB_SHA` names; `warn-only` reports `neutral` rather than red; and a
fork PR's read-only token means the comment is skipped, never fatal. The comment's marker is
keyed on the URL, which is what lets one workflow audit several pages.

Our own `.github/workflows/ci.yml` uses it (`uses: ./packages/action` with `cli-path`), so
the action is exercised on every push. **`@perfscope/cli` is not published to npm yet**, so
outside this repo `cli-path` is required — `packages/action/README.md` says so.

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

### User flows — measuring after the load

`/flows` runs a definition (a URL plus steps) through Lighthouse's flow API: one cold
navigation, then **each measured step inside its own timespan**, then a snapshot. One
timespan around the whole flow would report a single INP for five interactions and could not
say which was slow, which is the only question the feature answers.

The modes decide everything downstream, so nothing may assume a shape: a **timespan** has
INP/TBT/CLS and no LCP; a **snapshot** has no timing at all and its `performance: 0` is the
*absence* of a score, never a score (`FLOW_MODE_METRICS`/`FLOW_MODE_CATEGORIES` in shared are
what the server stores by and the client draws by). `flow-transform.ts` drops the rest.

Two things that are load-bearing and non-obvious: after an interaction the runner waits two
animation frames plus a settle (`settleAfterInteraction`) **inside** the timespan — INP is
input to *next paint*, and closing the window at `page.click()`'s resolution reports no INP
at all; and flows share `auditQueue` with audits, because a flow measuring INP against two
competing audits is not a measurement. Runs are stored in their own `FlowRun` collection,
never in `History` — budgets, `hasResult`, previous-run comparison and the dashboard averages
all assume a navigation audit.

**They run on their own and they can fail a promise.** `Flow.schedule` is one time a day
(not the website automation's slots/spread: running the same journey six times measures the
site's noise, not the journey), picked up by `cron/flowRuns.cron.ts` with a `lastScheduledAt`
re-entrancy guard — the cron ticks every minute and a flow takes minutes. `Flow.targets` are
ceilings over the **measured interactions only**; the navigation step is an ordinary audit
and the site's own budgets already cover it. A miss raises `flow.breach` through the same
`dispatchAlert` everything else uses, which means it needs a Website to file against —
resolved from the flow's URL by `findWebsiteByHost`, exactly as a persisted audit is. A flow
on an untracked URL still reports its failures and simply files nothing.

Backend: `services/flow.service.ts` (runner), `flow-transform.ts`, `flowInput.ts`
(validation — a bad step is rejected, never repaired), `flowSchedule.service.ts`,
`socket/flow.handler.ts`, `routes/flow.routes.ts`. Frontend: `features/flows` +
`pages/flows`.

### Teams — one account, more than one person

`/team` shares an account rather than moving data into a container: a team has an **owner**,
and a member's request is resolved to the owner's `userId` before any query runs
(`middleware/teamScope.ts`, mounted **above** the routers because they share the bare `/api`
mount). Nothing else in the codebase changed — no `teamId` column, no migration, and no
query that can forget to filter by team. `requireAuth` reads back the `scopeUserId` the
middleware wrote; sockets get the same treatment through `socket/scope.ts`, since a
handshake is the only place a socket can carry it.

The consequences are worth stating because they look like bugs otherwise: **deleting a team
deletes no data** (it only removes everyone else's access), the owner cannot leave their own
team, and `req.actorId` — not `req.userId` — is the person, which is why `team.routes.ts` is
the one router that reads it. Roles are `owner`/`member`/`viewer`, ordered in
`shared/types/team.ts`; the viewer guard refuses any non-GET except `/teams` and `/invites`,
so a viewer can still accept an invitation and leave.

Invitations are links, not emails (SMTP is optional here): a 32-byte token stored **hashed**
like every other bearer credential, single use, seven days, and shown exactly once — a
listing can revoke one but can never hand it back. Membership is cached for 15s per
(user, team) so an ordinary request still costs no database read; a role change or removal
drops the cache immediately.

Probes: `e2e/teams.probe.mjs` (the scoping claim, over real HTTP) and
`e2e/teams-ui.probe.mjs` (the switcher, the invite page, the read-only affordance).

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
- `models/` — Mongoose schemas: `User`, `Website`, `History`, `CompareHistory`, `CompetitorSession`, `Deploy`, `AlertLog`, `RumEvent`, `AiRecommendation`/`AiActionLog`, `CliAuthCode`, and the two that make sessions revocable — `RefreshToken`, `PasswordReset` (both store a **hash**, never the token)
- `routes/` — auth (+ refresh/logout/password reset), website CRUD + budgets + route discovery, deploys, history + share links, public report, compare history, advice, auth-audit sessions, competitor sessions, CrUX, RUM, onboarding, overview, notifications, CLI auth, legacy analyze

### Frontend layout (`apps/web-dashboard/src/`) — Feature-Sliced Design

Six FSD layers; imports flow strictly downward (`app` → `pages` → `widgets` → `features` → `entities` → `shared`). Slices use `ui/` (components), `model/` (hooks + Zustand stores), `api/` (slice network code), `lib/` (helpers) segments.

- `app/` — `App.tsx` (routes), `main.tsx` (providers + token wiring), `ErrorBoundary`, `styles/index.css`
- `pages/` — route-level pages; page-local components live in the page's own `ui/` (e.g. `pages/websites/ui/WebsiteCard.tsx`). The signed-out set (`login`, `register`, `forgot-password`, `reset-password`) shares `shared/ui/auth-card.tsx` — a page may not import another page's `ui/`, which is why that shell lives in `shared`
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

### Accessibility

`apps/backend/probes/app-a11y.probe.mts` audits the nine signed-in routes (`MOBILE=1` for
412px). It seeds a throwaway account with data first — empty states hide everything — and
opens `/app` through `/history?open=<id>` so the *report* is measured, not an empty form. All
nine are at 100; when adding UI, run it rather than guessing.

`apps/backend/probes/report-a11y.probe.mts` audits the *deep* report — the sweep above seeds
`/app` from an AI fixture, and `trimForAi` drops `timelineData`/`dependencyGraph`/`bundles`,
so the waterfall, flame chart, dependency chain, treemap and layout-shift visualiser were
never in the DOM it measured. This one runs a real audit, stores an older copy so the delta
layer renders, turns the comparison switch on (it is off by default) and reports three things
at 1350px and 412px: **how many of the 14 panels drew** (a 100 over four panels is not a
result), the accessibility snapshot, and what bleeds past the right edge. 13/14 locally —
field data needs `CRUX_API_KEY`. It found the report at 95, now 100.

Four rules these enforce: **never put `opacity` on a `--ld-*` text token** (they are
tuned to clear 4.5:1 exactly, so dimming drops them below AA — icons and hover-reveals are
fine); **every form control gets a real label** via `shared/ui/field.tsx`'s `Field`,
which owns the `useId`/`htmlFor`/`aria-describedby` wiring — an icon-only button or link needs
an `aria-label`, and an `aria-label` on a control with visible text must *contain* that text;
**panel and section titles are `h2`** (`PanelHeader`, the analyzer's `SectionTitle`, the audit
list's header) under each page's single `h1`, with anything nested inside a panel at `h3` —
`AlertTitle` is a `<p>`, not a heading, because `role="alert"` is what announces it; and a
**range input that is invisible or has its thumb redrawn carries its own `aria-label`** (both
scrub tracks and `shared/ui/scrubber.tsx`), since there is no visible text for one to point at.

Layout on a phone is `e2e/mobile-layout.probe.mjs`, which asserts proportion and reachability
rather than only overflow. Its selectors name elements: when a component changes tag, check the
counts it prints — an `every()` over an empty list passes.

### Styling

Pure Tailwind with a custom CSS variable design system. Variables are defined in `apps/web-dashboard/src/app/styles/index.css` under `:root` / `[data-theme="light"]` selectors and prefixed with `--ps-`. Inline styles using these vars are the norm for interactive color changes (hover states, active nav items). `ThemeProvider` manages the `data-theme` attribute on `<html>`.
