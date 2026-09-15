/**
 * What each documented route takes and answers with — the one hand-written input to
 * `docs/api/openapi.json`.
 *
 * Everything else about a route (method, path, token, purpose, section) is read from
 * `docs/api/README.md` by `build.mts`, which also refuses to run while this table and the
 * README disagree about which routes exist.
 *
 * Name a `@perfscope/shared` type wherever one describes the wire shape; the build fails on
 * a name shared does not export. An inline schema is written only where no shared type
 * exists — each is a candidate for moving into shared, not a second source to keep.
 */

export type Schema = Record<string, unknown>;

export interface QueryParam {
  schema:       Schema;
  required?:    boolean;
  description?: string;
}

export interface OperationTypes {
  /**
   * `data` inside the `{ success: true, data }` envelope: a shared type name (`X[]` for an
   * array of one), an inline schema, or `null` for routes that answer `data: null`.
   */
  response:         string | Schema | null;
  /** The request body: a shared type name or an inline schema. */
  body?:            string | Schema;
  bodyContentType?: string;
  query?:           Record<string, QueryParam>;
  /** Success status when it is not 200. */
  status?:          number;
  /** A route that does not answer JSON (`/rum.js`, `/metrics`). */
  contentType?:     string;
  /** A JSON route that does not use the envelope (`/health`, the shields badge). */
  raw?:             boolean;
}

const str  = { type: 'string' } as const;
const int  = { type: 'integer' } as const;
const bool = { type: 'boolean' } as const;

const nul  = { type: 'null' } as const;

/** An object whose listed keys are all required unless named in `optional`. */
const obj = (properties: Record<string, Schema>, optional: string[] = []): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties).filter(k => !optional.includes(k)),
});

/** A shared type used *inside* an inline schema; `build.mts` collects these too. */
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const orNull = (schema: Schema): Schema => ({ oneOf: [schema, nul] });
const arr = (items: Schema): Schema => ({ type: 'array', items });

const q = (schema: Schema, description?: string): QueryParam =>
  (description ? { schema, description } : { schema });
const formFactor = q({ type: 'string', enum: ['mobile', 'desktop'] });
const days = q(int, 'Window in days.');

const SESSION = obj({
  cookies:      arr({ type: 'object' }),
  localStorage: { type: 'object', additionalProperties: str },
});

export const OPERATIONS: Record<string, OperationTypes> = {
  // ── Analysis ──
  'POST /api/analyze': {
    body:     obj({ url: str }),
    response: obj({ result: ref('AnalysisResult'), savedToHistory: bool }),
  },

  // ── Auth and account ──
  'POST /api/auth/register':        { status: 201, body: obj({ name: str, email: str, password: str }), response: 'AuthResponse' },
  'POST /api/auth/login':           { body: obj({ email: str, password: str }), response: 'AuthResponse' },
  'POST /api/auth/google':          { body: obj({ accessToken: str }), response: 'AuthResponse' },
  'POST /api/auth/refresh':         { body: obj({ refreshToken: str }), response: 'AuthResponse' },
  'POST /api/auth/logout':          { body: obj({ refreshToken: str }, ['refreshToken']), response: null },
  'POST /api/auth/logout-all': {
    body:     obj({ refreshToken: { ...str, description: 'The session to keep.' } }, ['refreshToken']),
    response: obj({ ended: int }),
  },
  'POST /api/auth/forgot-password': { body: obj({ email: str }), response: obj({ sent: { type: 'boolean', const: true } }) },
  'POST /api/auth/reset-password':  { body: obj({ token: str, password: str }), response: null },
  'PATCH /api/auth/password': {
    body:     obj({ currentPassword: str, newPassword: str, refreshToken: str }, ['currentPassword', 'refreshToken']),
    response: obj({ ended: int }),
  },
  'PATCH /api/auth/profile':        { body: obj({ name: { ...str, maxLength: 60 } }), response: 'AuthResponse' },
  'GET /api/auth/digest':           { response: 'DigestPreference' },
  'PATCH /api/auth/digest': {
    body:     obj({ enabled: bool, day: { ...int, minimum: 0, maximum: 6 }, time: { ...str, pattern: '^\\d{2}:\\d{2}$' } }, ['enabled', 'day', 'time']),
    response: 'DigestPreference',
  },
  'POST /api/auth/cli/init':        { body: obj({ code: { ...str, maxLength: 128 } }), response: null },
  'POST /api/auth/cli/complete':    { body: obj({ code: str }), response: null },
  'GET /api/auth/cli/poll': {
    query:    { code: { ...q(str), required: true } },
    response: { oneOf: [obj({ pending: { type: 'boolean', const: true } }), obj({ token: str, refreshToken: str })] },
  },

  // ── Websites ──
  'GET /api/websites': {
    query:    { q: q(str, 'Search by name or URL.'), page: q(int), limit: q(int) },
    response: { oneOf: [arr(ref('WebsiteDoc')), ref('WebsitePage')],
      description: 'A plain list without `q`, `page` or `limit`; a page when any of them is given.' },
  },
  'POST /api/websites':                   { status: 201, body: obj({ url: str, name: str }, ['name']), response: 'WebsiteDoc' },
  'DELETE /api/websites/:id':             { response: null },
  'GET /api/websites/summary':            { response: 'WebsiteSummary' },
  'GET /api/websites/:id/routes':         { response: 'RouteDiscovery' },
  'PATCH /api/websites/:id/budgets':      { body: 'WebsiteBudgets', response: 'WebsiteDoc' },
  'PATCH /api/websites/:id/automation': {
    body: obj({
      enabled:       bool,
      routes:        arr(str),
      scheduleTime:  str,
      scheduleMode:  ref('AutomationScheduleMode'),
      slots:         arr(ref('AutomationSlot')),
      spreadMinutes: int,
    }, ['enabled', 'routes', 'scheduleTime', 'scheduleMode', 'slots', 'spreadMinutes']),
    response: 'WebsiteDoc',
  },
  'POST /api/websites/:id/automation/run': { response: obj({ message: str }) },
  'PATCH /api/websites/:id/session':       { body: SESSION, response: 'WebsiteDoc' },
  'GET /api/websites/:id/alerts': {
    query:    { limit: q(int) },
    response: arr(obj({
      _id: str, url: str, event: str,
      status:     { type: 'string', enum: ['firing', 'recovered', 'event'] },
      metrics:    arr(str),
      analysisId: orNull(str),
      lines:      arr(str),
      aiNote:     str,
      delivery:   arr(obj({ channel: { type: 'string', enum: ['webhook', 'email'] }, ok: bool, error: orNull(str) })),
      createdAt:  str,
    }, ['aiNote'])),
  },
  'GET /api/websites/:id/deploys':  { query: { days }, response: 'Deploy[]' },
  'POST /api/websites/:id/deploys': { status: 201, body: 'DeployInput', response: 'Deploy' },
  'DELETE /api/deploys/:id':        { response: null },

  // ── Real-user monitoring ──
  'GET /rum.js':  { contentType: 'application/javascript', response: null },
  'POST /api/rum': {
    status: 204,
    // sendBeacon cannot send application/json without a preflight, so the snippet does not.
    bodyContentType: 'text/plain',
    body:     'RumBeacon',
    response: null,
  },
  'POST /api/websites/:id/rum-key':    { response: obj({ rumKey: str }) },
  'GET /api/websites/:id/rum':         { query: { days, path: q(str), device: formFactor }, response: 'RumResponse' },
  'GET /api/websites/:id/rum/trend': {
    query:    { metric: q(ref('VitalKey')), days, device: formFactor },
    response: 'RumTrend',
  },
  'GET /api/crux': {
    query:    { url: { ...q(str), required: true }, formFactor },
    response: orNull(ref('CruxData')),
  },

  // ── History, sharing and projects ──
  'GET /api/history/all':             { response: 'HistoryEntry[]' },
  'GET /api/history':                 { query: { url: { ...q(str), required: true } }, response: 'HistoryEntry[]' },
  'GET /api/history/scheduled':       { response: 'ScheduledSiteReport[]' },
  'GET /api/history/:id':             { response: 'AnalysisResult' },
  'DELETE /api/history/:id':          { response: null },
  'POST /api/history/:id/ask': {
    body:     obj({ question: { ...str, maxLength: 500 } }),
    response: obj({ answer: str, questionsRemaining: int }),
  },
  'POST /api/history/:id/share':      { response: obj({ token: { ...str, pattern: '^[a-f0-9]{32}$' } }) },
  'DELETE /api/history/:id/share':    { response: null },
  'GET /api/public/report/:token':    { response: 'PublicReport' },
  'GET /api/public/badge/:token': {
    raw: true,
    query: { category: q({ type: 'string', enum: ['performance', 'accessibility', 'seo', 'bestPractices'] }) },
    response: obj({
      schemaVersion: { type: 'integer', const: 1 },
      label:   str,
      message: str,
      color:   { type: 'string', enum: ['brightgreen', 'yellow', 'red'] },
    }),
  },
  'GET /api/projects/:id/audits':     { response: 'ProjectAuditsResult' },
  'GET /api/overview': {
    query:    { days, from: q(str, 'YYYY-MM-DD, UTC.'), to: q(str, 'YYYY-MM-DD, UTC.'), websiteId: q(str) },
    response: 'OverviewData',
  },
  'GET /api/onboarding/status':       { response: 'OnboardingStatus' },
  'GET /api/notifications':           { query: { limit: q(int) }, response: 'NotificationsResponse' },
  'POST /api/notifications/seen':     { response: obj({ seenAt: str }) },

  // ── Comparison and competitors ──
  'GET /api/compare-history':         { query: { search: q(str) }, response: 'CompareEntry[]' },
  'POST /api/compare-history': {
    body: obj({
      sourceUrl: str, targetUrl: str,
      source: ref('ComparisonSide'), competitor: ref('ComparisonSide'),
      sourceAnalysisId: str, competitorAnalysisId: str,
    }, ['sourceAnalysisId', 'competitorAnalysisId']),
    response: obj({ aiVerdict: orNull(str) }),
  },
  'GET /api/compare-history/:pairId':     { response: 'CompareEntry[]' },
  'GET /api/competitor-sessions':         { response: 'CompetitorSessionEntry[]' },
  'DELETE /api/competitor-sessions/:id':  { response: null },

  // ── Auditing behind a login ──
  'POST /api/auth-audit/session':                    { body: obj({ url: str }), response: 'AuthAuditSessionResponse' },
  'GET /api/auth-audit/session/:sessionId':          { response: null },
  'GET /api/auth-audit/session/:sessionId/extract':  { response: SESSION },
  'DELETE /api/auth-audit/session/:sessionId':       { response: null },

  // ── User flows ──
  'GET /api/flows':          { response: 'FlowDefinition[]' },
  'POST /api/flows':         { status: 201, body: 'FlowInput', response: 'FlowDefinition' },
  'PUT /api/flows/:id':      { body: 'FlowInput', response: 'FlowDefinition' },
  'DELETE /api/flows/:id':   { response: null },
  'GET /api/flows/:id/runs': { query: { limit: q(int) }, response: 'FlowRunResult[]' },
  'GET /api/flow-runs/:id':  { response: 'FlowRunResult' },

  // ── Teams ──
  'GET /api/teams':                             { response: 'TeamSummary[]' },
  'POST /api/teams':                            { status: 201, body: obj({ name: str }), response: 'TeamDetail' },
  'GET /api/teams/:id':                         { response: 'TeamDetail' },
  'PATCH /api/teams/:id':                       { body: obj({ name: { ...str, maxLength: 60 } }), response: 'TeamDetail' },
  'DELETE /api/teams/:id':                      { response: obj({ deleted: { type: 'boolean', const: true } }) },
  'PATCH /api/teams/:id/members/:userId':       { body: obj({ role: { type: 'string', enum: ['member', 'viewer'] } }), response: 'TeamDetail' },
  'DELETE /api/teams/:id/members/:userId':      { response: obj({ removed: { type: 'boolean', const: true } }) },
  'GET /api/teams/:id/invites':                 { response: 'TeamInviteInfo[]' },
  'POST /api/teams/:id/invites':                { status: 201, body: obj({ role: { type: 'string', enum: ['member', 'viewer'] } }), response: 'TeamInviteInfo' },
  'DELETE /api/teams/:id/invites/:inviteId':    { response: obj({ revoked: { type: 'boolean', const: true } }) },
  'GET /api/invites/:token':                    { response: 'TeamInvitePreview' },
  'POST /api/invites/:token/accept':            { response: 'TeamDetail' },

  // ── AI advice ──
  'GET /api/advice': {
    query:    { scope: q(str), url: q(str) },
    response: orNull(ref('AiAdvice')),
  },
  'POST /api/advice/acted': {
    body:     obj({ kind: { type: 'string', enum: ['audit', 'schedule', 'compare', 'budgets'] }, url: str }),
    response: null,
  },

  // ── Operational ──
  'GET /health': {
    raw: true,
    response: obj({
      status:   { type: 'string', const: 'ok' },
      uptime:   int,
      database: { type: 'string', enum: ['up', 'down'] },
      version:  str,
    }),
  },
  'GET /metrics': { contentType: 'text/plain; version=0.0.4', response: null },
};
