# HTTP API

Every route the backend serves, what it is for, and whether it needs a token. Kept honest by
`apps/backend/src/routes/routes.contract.test.ts`, which fails when a route is added, moved
or removed without this file changing.

## Conventions

**Envelope.** Every `/api` route answers `{ "success": true, "data": … }` or
`{ "success": false, "error": "…" }`. Clients unwrap once — the dashboard's axios
interceptor, `createApiClient` in `@perfscope/shared`, and `packages/cli/src/api.js` — and a
body without the envelope is passed through rather than nulled, because the CLI may be
talking to an older backend.

**Auth.** `Authorization: Bearer <access token>` from `/api/auth/login` or `/register`.
Access tokens last 30 minutes; `/api/auth/refresh` rotates the pair. A member acting inside
a team sends `X-Team-Id` and every query below is resolved to the team owner's account
(`middleware/teamScope.ts`).

**Storage.** With MongoDB unavailable, read routes answer empty shapes and set
`X-Storage-State: unavailable` rather than failing; writes are refused.

**Rows in the tables below**: 🔓 = no token needed, 🔑 = token required.

## Analysis

The live pipeline is a **WebSocket**, not these routes — `analysis:start` over Socket.io, see
the architecture notes in CLAUDE.md. The REST entry point below still works and is published,
but no first-party client uses it.

| | Route | What it does |
|---|---|---|
| 🔑 | `POST /api/analyze` | Run one audit and answer with the whole result. Raises its own connection timeout past the server-wide 70s, because an audit can take minutes. |

## Auth and account

| | Route | What it does |
|---|---|---|
| 🔓 | `POST /api/auth/register` | Create an account; answers with the user and a token pair. |
| 🔓 | `POST /api/auth/login` | Email and password. One message for "no such account" and "wrong password" — telling them apart turns the form into an account-existence oracle. |
| 🔓 | `POST /api/auth/google` | Verify a Google access token server-side and upsert the user **by email**, so a password account and a Google sign-in are one account. |
| 🔓 | `POST /api/auth/refresh` | Rotate the pair. Presenting a spent refresh token revokes its whole family. |
| 🔑 | `POST /api/auth/logout` | End this session. |
| 🔑 | `POST /api/auth/logout-all` | End every other session (Settings → Signed-in devices). |
| 🔓 | `POST /api/auth/forgot-password` | Always answers identically — for a real address, a Google-only account and an unknown one alike. |
| 🔓 | `POST /api/auth/reset-password` | Single-use token, one hour; ends every session. |
| 🔑 | `PATCH /api/auth/password` | Change, or for a Google-only account set, the password. |
| 🔑 | `PATCH /api/auth/profile` | Change the display name. |
| 🔑 | `GET /api/auth/digest` | Current weekly-summary preference. |
| 🔑 | `PATCH /api/auth/digest` | Opt in or out of the weekly summary. |

### CLI sign-in

| | Route | What it does |
|---|---|---|
| 🔓 | `POST /api/auth/cli/init` | Start a browser sign-in and return a code. |
| 🔑 | `POST /api/auth/cli/complete` | The browser confirms the code; the CLI is minted a session **of its own** rather than a copy of the browser's. |
| 🔓 | `GET /api/auth/cli/poll` | The CLI collects its token pair once the browser has confirmed. |

## Websites

| | Route | What it does |
|---|---|---|
| 🔑 | `GET /api/websites` | Tracked sites; `?q=&page=&limit=`. |
| 🔑 | `POST /api/websites` | Track a site. |
| 🔑 | `DELETE /api/websites/:id` | Stop tracking it. |
| 🔑 | `GET /api/websites/summary` | Account-wide headline numbers. |
| 🔑 | `GET /api/websites/:id/routes` | Routes discovered from the site's sitemap — a 200 from `/sitemap.xml` proves nothing, the body has to look like one. |
| 🔑 | `PATCH /api/websites/:id/budgets` | Set or clear performance budgets and their alert channels. |
| 🔑 | `PATCH /api/websites/:id/automation` | Scheduled audits: mode, slots, routes. |
| 🔑 | `POST /api/websites/:id/automation/run` | Trigger the schedule now, for one site. |
| 🔑 | `PATCH /api/websites/:id/session` | Attach or clear a captured login session. The session itself never comes back out — see `models/session.schema.ts`. |
| 🔑 | `GET /api/websites/:id/alerts` | What was sent, when, and whether it landed. |
| 🔑 | `GET /api/websites/:id/deploys` | Release markers drawn on the trend charts. |
| 🔑 | `POST /api/websites/:id/deploys` | Record one (also `perfscope deploy`). |
| 🔑 | `DELETE /api/deploys/:id` | Remove a marker. |

## Real-user monitoring

| | Route | What it does |
|---|---|---|
| 🔓 | `GET /rum.js` | The collector script, served at the **root** and loaded from other people's sites. Cacheable — it is the same file for every site. |
| 🔓 | `POST /api/rum` | One page view. Answers 204 whatever happens: the browser is on its way elsewhere and cannot act on an error. |
| 🔑 | `POST /api/websites/:id/rum-key` | Issue or rotate the public key the snippet carries. |
| 🔑 | `GET /api/websites/:id/rum` | Field data from the site's own visitors. |
| 🔑 | `GET /api/websites/:id/rum/trend` | Daily p75 for one metric. |
| 🔑 | `GET /api/crux` | Chrome UX Report data for any URL; `?url=&formFactor=`. Falls back from URL to origin. Empty without `CRUX_API_KEY`. |

## History, sharing and projects

| | Route | What it does |
|---|---|---|
| 🔑 | `GET /api/history/all` | Every stored audit for the account. |
| 🔑 | `GET /api/history` | Entries for one URL; `?url=`. |
| 🔑 | `GET /api/history/scheduled` | What the automation ran, grouped by site and route. |
| 🔑 | `GET /api/history/:id` | The full stored result. |
| 🔑 | `DELETE /api/history/:id` | Remove one audit. |
| 🔑 | `POST /api/history/:id/ask` | Answer one question against that audit's own data. |
| 🔑 | `POST /api/history/:id/share` | Mint (or return) a 32-hex public token. |
| 🔑 | `DELETE /api/history/:id/share` | Revoke the link. |
| 🔓 | `GET /api/public/report/:token` | The shared report. The unguessable token **is** the credential; a malformed one is a 404, not a 400. |
| 🔓 | `GET /api/public/badge/:token` | shields.io endpoint JSON for that report; `?category=performance\|accessibility\|seo\|bestPractices`. |
| 🔑 | `GET /api/projects/:id/audits` | Project history grouped by route, with trend detection. |
| 🔑 | `GET /api/overview` | Dashboard window; `?days=` or `?from=&to=`, resolved by shared `resolveOverviewRange` so the tiles and charts cannot name a different window from the one they counted. |
| 🔑 | `GET /api/onboarding/status` | Which first steps are done. |
| 🔑 | `GET /api/notifications` | The alert feed. |
| 🔑 | `POST /api/notifications/seen` | Mark the feed read — one timestamp, not per-item state. |

## Comparison and competitors

| | Route | What it does |
|---|---|---|
| 🔑 | `GET /api/compare-history` | Unique pairs, latest per pair. |
| 🔑 | `POST /api/compare-history` | Save a comparison result. |
| 🔑 | `GET /api/compare-history/:pairId` | Full trend for one pair. |
| 🔑 | `GET /api/competitor-sessions` | Saved logins for competitor audits. |
| 🔑 | `DELETE /api/competitor-sessions/:id` | Forget one. |

## Auditing behind a login

Two phases: open a **visible** browser, let a person sign in, then harvest the session into
the audit. **Needs a display** — a container answers 503 saying so.

| | Route | What it does |
|---|---|---|
| 🔑 | `POST /api/auth-audit/session` | Launch the browser at a URL; returns a `sessionId`. |
| 🔑 | `GET /api/auth-audit/session/:sessionId` | Is that session still alive? |
| 🔑 | `GET /api/auth-audit/session/:sessionId/extract` | Harvest cookies and localStorage from the live browser. |
| 🔑 | `DELETE /api/auth-audit/session/:sessionId` | Close the browser and end the session. |

## User flows

| | Route | What it does |
|---|---|---|
| 🔑 | `GET /api/flows` | Every flow, newest edit first. |
| 🔑 | `POST /api/flows` | Create one. A bad step is rejected, never repaired. |
| 🔑 | `PUT /api/flows/:id` | The editor saves the whole definition, not a patch. |
| 🔑 | `DELETE /api/flows/:id` | Remove it. |
| 🔑 | `GET /api/flows/:id/runs` | That flow's own history — `FlowRun`, never `History`. |
| 🔑 | `GET /api/flow-runs/:id` | One stored flow report. |

## Teams

A team is permission to act as its **owner**; there is no `teamId` on any other document.

| | Route | What it does |
|---|---|---|
| 🔑 | `GET /api/teams` | Teams this person owns or belongs to. |
| 🔑 | `POST /api/teams` | Create one. |
| 🔑 | `GET /api/teams/:id` | Members and pending invitations. |
| 🔑 | `PATCH /api/teams/:id` | Rename. |
| 🔑 | `DELETE /api/teams/:id` | **Deletes no data** — it removes everyone else's access. |
| 🔑 | `PATCH /api/teams/:id/members/:userId` | Change a role (`owner`/`member`/`viewer`). |
| 🔑 | `DELETE /api/teams/:id/members/:userId` | Remove a member, or leave. An owner cannot leave their own team. |
| 🔑 | `GET /api/teams/:id/invites` | Outstanding invitations. Tokens are stored hashed and shown exactly once. |
| 🔑 | `POST /api/teams/:id/invites` | Mint one: 32 bytes, single use, seven days. |
| 🔑 | `DELETE /api/teams/:id/invites/:inviteId` | Revoke it. |
| 🔓 | `GET /api/invites/:token` | What this invitation is for, before signing in. |
| 🔑 | `POST /api/invites/:token/accept` | Accept it. A viewer may still do this, and leave. |

## AI advice

| | Route | What it does |
|---|---|---|
| 🔑 | `GET /api/advice` | Stored recommendations for the account. |
| 🔑 | `POST /api/advice/acted` | Mark one as acted on, so the next audit can say whether it helped. |

## Operational

Not part of the `/api` surface and not proxied to the public origin by the dashboard's nginx.

| | Route | What it does |
|---|---|---|
| 🔓 | `GET /health` | `{ status, uptime, database, version }`. `database` is reported, never a 503. |
| 🔓 | `GET /metrics` | Prometheus text format. Internal by default; `METRICS_TOKEN` guards it where the port is exposed. See [OBSERVABILITY.md](../deploy/OBSERVABILITY.md). |
