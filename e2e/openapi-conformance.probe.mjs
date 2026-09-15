/**
 * Does `docs/api/openapi.json` describe what the running server actually answers?
 *
 * The spec is generated from the shared types, and a type is a claim, not a response — a
 * route can hand back a Mongoose document with extra fields, forget a projection, or wrap
 * its data differently from what the client reads. That last one is not hypothetical: the
 * public report page read `{ result, sharedAt }` as the result itself, so every shared link
 * crashed into the error boundary, and nothing noticed.
 *
 * So this seeds a throwaway account with a little of everything (a site, a deploy, a team,
 * a flow, a stored audit cloned from a real one and shared), calls the read routes over
 * real HTTP and validates each body against the schema the spec gives that operation. Then
 * it opens the shared report in a browser, because a body that matches the spec proves
 * nothing about a page that reads it wrongly.
 *
 * Needs the backend (3101), the dashboard (5173) and Mongo, plus at least one stored audit
 * with a full result in the database to clone. From the repo root:
 *
 *     node e2e/openapi-conformance.probe.mjs
 */
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  BACKEND_URL, WEB_URL, MONGODB_URI, waitForServers, registerUser, cleanupUser, launchAuthedBrowser, bodyText,
} from './helpers.mjs';

const spec = JSON.parse(readFileSync(new URL('../docs/api/openapi.json', import.meta.url), 'utf8'));

const ajv = new Ajv2020({ strict: false, allErrors: true });
// The generator's `format` keywords (date-time) are annotations here, not assertions.
ajv.addFormat?.('date-time', true);
ajv.addSchema({ $id: 'spec', components: spec.components });

/** The schema the spec gives an operation's success body, with refs pointed at the spec. */
function responseSchema(method, path) {
  const op = spec.paths[path]?.[method.toLowerCase()];
  if (!op) throw new Error(`spec has no ${method} ${path}`);
  const [status, response] = Object.entries(op.responses).find(([code]) => /^2/.test(code));
  const schema = response.content?.['application/json']?.schema;
  return { status: Number(status), schema: schema && JSON.parse(JSON.stringify(schema).replaceAll('"#/components/', '"spec#/components/')) };
}

const results = [];

async function check(method, specPath, url, { token, body } = {}) {
  const res = await fetch(`${BACKEND_URL}${url}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const { status, schema } = responseSchema(method, specPath);
  const json = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  let errors = null;
  if (res.status !== status) {
    errors = [`HTTP ${res.status}, spec says ${status}: ${JSON.stringify(json)?.slice(0, 200)}`];
  } else if (schema) {
    const validate = ajv.compile(schema);
    if (!validate(json)) {
      errors = validate.errors.slice(0, 5).map(e => `${e.instancePath || '(root)'} ${e.message} ${JSON.stringify(e.params)}`);
    }
  }
  results.push({ route: `${method} ${specPath}`, ok: !errors, errors });
  return json?.data ?? json;
}

await waitForServers();
const { token, user, email } = await registerUser();
const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db();
let teamId = null;

try {
  // ── Seed ──
  const site = await check('POST', '/api/websites', '/api/websites', { token, body: { url: 'https://example.com', name: 'Example' } });
  await check('POST', '/api/websites/{id}/deploys', `/api/websites/${site._id}/deploys`, { token, body: { label: 'v1' } });
  const team = await check('POST', '/api/teams', '/api/teams', { token, body: { name: 'Conformance' } });
  teamId = team?.id;
  await check('POST', '/api/flows', '/api/flows', {
    token,
    body: { name: 'Probe flow', url: 'https://example.com', steps: [{ action: 'wait', value: '100' }] },
  });

  const donor = await db.collection('histories').findOne({ fullResult: { $exists: true } }, { sort: { createdAt: -1 } });
  if (!donor) throw new Error('No stored audit with a full result to clone — run one audit first.');
  const shareToken = randomBytes(16).toString('hex');
  // `/api/history/:id` is keyed by analysisId, not the document's _id.
  const analysisId = randomUUID();
  await db.collection('histories').insertOne({
    ...donor, _id: new ObjectId(), analysisId, userId: String(user.sub), shareToken, createdAt: new Date(),
  });

  // ── Reads ──
  await check('GET', '/api/websites', '/api/websites', { token });
  await check('GET', '/api/websites', '/api/websites?page=1&limit=5', { token });
  await check('GET', '/api/websites/summary', '/api/websites/summary', { token });
  await check('GET', '/api/websites/{id}/deploys', `/api/websites/${site._id}/deploys`, { token });
  await check('GET', '/api/websites/{id}/rum', `/api/websites/${site._id}/rum`, { token });
  await check('GET', '/api/websites/{id}/alerts', `/api/websites/${site._id}/alerts`, { token });
  await check('PATCH', '/api/websites/{id}/budgets', `/api/websites/${site._id}/budgets`, { token, body: { performance: 80 } });
  await check('GET', '/api/history/all', '/api/history/all', { token });
  await check('GET', '/api/history', `/api/history?url=${encodeURIComponent(donor.url)}`, { token });
  await check('GET', '/api/history/{id}', `/api/history/${analysisId}`, { token });
  await check('GET', '/api/history/scheduled', '/api/history/scheduled', { token });
  await check('GET', '/api/public/report/{token}', `/api/public/report/${shareToken}`);
  await check('GET', '/api/public/badge/{token}', `/api/public/badge/${shareToken}`);
  await check('GET', '/api/overview', '/api/overview?days=7', { token });
  await check('GET', '/api/onboarding/status', '/api/onboarding/status', { token });
  await check('GET', '/api/notifications', '/api/notifications', { token });
  await check('GET', '/api/compare-history', '/api/compare-history', { token });
  await check('GET', '/api/competitor-sessions', '/api/competitor-sessions', { token });
  await check('GET', '/api/flows', '/api/flows', { token });
  await check('GET', '/api/teams', '/api/teams', { token });
  if (teamId) {
    await check('GET', '/api/teams/{id}', `/api/teams/${teamId}`, { token });
    await check('POST', '/api/teams/{id}/invites', `/api/teams/${teamId}/invites`, { token, body: { role: 'viewer' } });
    await check('GET', '/api/teams/{id}/invites', `/api/teams/${teamId}/invites`, { token });
  }
  await check('GET', '/api/auth/digest', '/api/auth/digest', { token });
  await check('PATCH', '/api/auth/digest', '/api/auth/digest', { token, body: { enabled: false } });
  await check('GET', '/api/advice', '/api/advice', { token });
  await check('GET', '/health', '/health');

  // ── The page that read the wrong shape ──
  const { browser, page, errors } = await launchAuthedBrowser({ user, token });
  try {
    await page.goto(`${WEB_URL}/report/${shareToken}`, { waitUntil: 'networkidle0' });
    const text = await bodyText(page);
    const audited = /audited (.+)/.exec(text)?.[1] ?? '';
    const ok = !/Invalid Date/.test(text) && /Performance/i.test(text) && audited.length > 0;
    results.push({
      route: 'page /report/:token',
      ok,
      errors: ok ? null : [`rendered: ${text.slice(0, 300).replace(/\s+/g, ' ')}`],
    });
    if (errors.length) console.log('  page errors:', errors.slice(0, 3));
  } finally {
    await browser.close();
  }
} finally {
  if (teamId) {
    await db.collection('teams').deleteMany({ _id: new ObjectId(teamId) });
    await db.collection('teaminvites').deleteMany({ teamId: new ObjectId(teamId) });
  }
  await db.collection('deploys').deleteMany({ userId: { $in: [String(user.sub), new ObjectId(user.sub)] } });
  await client.close();
  await cleanupUser(email);
}

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.route}`);
  for (const e of r.errors ?? []) console.log(`        ${e}`);
}
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} match the spec`);
process.exit(failed ? 1 : 0);
