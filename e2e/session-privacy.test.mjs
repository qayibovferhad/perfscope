import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import { BACKEND_URL, MONGODB_URI, waitForBackend, registerUser, cleanupUser } from './helpers.mjs';

/**
 * The captured-session cookies must never reach the client.
 *
 * The auth-audit flow harvests real login cookies from a live browser so Lighthouse can
 * measure a page behind a login wall. Every endpoint that returns a Website — including
 * three PATCHes and an upsert that hands back the existing document — used to serialise
 * those cookies straight into the response, and the competitor-session list handed over a
 * rival's. The client never wanted them: it only ever asks whether a session exists.
 *
 * A projection on each query is what this replaced, and it is exactly what someone would
 * add back one route at a time. Hence a test at the wire, not at the model.
 */

const CANARY = 'CANARY-SESSION-COOKIE-VALUE';

const session = {
  cookies: [{ name: 'sid', value: CANARY, domain: 'privacy-probe.example.com', path: '/' }],
  localStorage: { token: CANARY },
  capturedAt: new Date(),
};

test('captured session cookies never reach the client', async (t) => {
  await waitForBackend();

  const { token, user, email } = await registerUser();
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  // The JWT payload names the account `sub`, and registerUser hands that payload back.
  const oid = new ObjectId(String(user.sub));

  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db();

  // Seeded directly: competitor sessions have no create route (the auth-audit socket
  // flow makes them), and this way both documents carry an identical, findable value.
  const { insertedId: siteId } = await db.collection('websites').insertOne({
    userId: oid, url: 'https://privacy-probe.example.com', name: 'Privacy Probe',
    session, automation: { enabled: false, routes: [], scheduleTime: '00:00' },
    createdAt: new Date(), updatedAt: new Date(),
  });
  await db.collection('competitorsessions').insertOne({
    userId: oid, url: 'https://rival.example.com', name: 'Rival',
    session, createdAt: new Date(), updatedAt: new Date(),
  });

  const call = (path, opts = {}) =>
    fetch(`${BACKEND_URL}/api${path}`, { headers: auth, ...opts }).then(async (r) => ({
      status: r.status,
      text: await r.text(),
    }));

  const endpoints = [
    ['GET /websites', () => call('/websites')],
    ['GET /websites (paginated)', () => call('/websites?page=1&limit=10')],
    ['POST /websites (upsert returns the existing doc)', () =>
      call('/websites', { method: 'POST', body: JSON.stringify({ url: 'https://privacy-probe.example.com', name: 'Privacy Probe' }) })],
    ['PATCH /websites/:id/session', () =>
      call(`/websites/${siteId}/session`, { method: 'PATCH', body: JSON.stringify({ cookies: session.cookies, localStorage: session.localStorage }) })],
    ['PATCH /websites/:id/automation', () =>
      call(`/websites/${siteId}/automation`, { method: 'PATCH', body: JSON.stringify({ enabled: false, routes: ['/'], scheduleTime: '03:00' }) })],
    ['PATCH /websites/:id/budgets', () =>
      call(`/websites/${siteId}/budgets`, { method: 'PATCH', body: JSON.stringify({ performance: 80 }) })],
    ['GET /competitor-sessions', () => call('/competitor-sessions')],
  ];

  try {
    for (const [label, run] of endpoints) {
      await t.test(label, async () => {
        const { status, text } = await run();
        assert.ok(status < 400, `${label} returned HTTP ${status}: ${text.slice(0, 200)}`);
        assert.ok(
          !text.includes(CANARY),
          `${label} put the captured session cookie on the wire`,
        );
      });
    }

    await t.test('the client still learns that a session exists, and when', async () => {
      const { text } = await call('/websites');
      // Every endpoint answers `{ success, data }` now — see backend lib/respond.ts.
      const { data } = JSON.parse(text);
      const site = data.find((w) => w.url === 'https://privacy-probe.example.com');
      assert.deepEqual(
        Object.keys(site.session),
        ['capturedAt'],
        'session should carry the capture time and nothing else',
      );
      assert.ok(Date.parse(site.session.capturedAt), 'capturedAt should be a date');
    });
  } finally {
    await client.close();
    await cleanupUser(email);
  }
});
