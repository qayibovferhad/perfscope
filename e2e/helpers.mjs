import puppeteer from 'puppeteer';
import { MongoClient } from 'mongodb';

export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:3101';
export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
export const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/perfscope';

/** Unique per-run address so parallel test files never collide and cleanup is exact. */
export function uniqueEmail() {
  return `e2e-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@perfscope.dev`;
}

async function respondsBelow500(url) {
  try {
    const res = await fetch(url);
    // The backend has no /health route; any HTTP response (even a 404) proves it is up.
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Wait for the API alone — for suites that never open a browser. */
export async function waitForBackend(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await respondsBelow500(`${BACKEND_URL}/api`)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Backend not reachable within ${timeoutMs}ms (${BACKEND_URL}). Start it: pnpm dev:backend`);
}

/**
 * Wait until both dev servers answer HTTP. The suite never starts servers itself —
 * `pnpm dev:backend` and `pnpm dev:web` must already be running.
 */
export async function waitForServers(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [backend, web] = await Promise.all([
      respondsBelow500(`${BACKEND_URL}/api`),
      respondsBelow500(`${WEB_URL}/`),
    ]);
    if (backend && web) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `Servers not reachable within ${timeoutMs}ms (backend: ${BACKEND_URL}, web: ${WEB_URL}). ` +
      'Start them first: pnpm dev:backend & pnpm dev:web',
  );
}

/** Register a throwaway user via the real REST endpoint and return { token, user, email }. */
export async function registerUser(email = uniqueEmail()) {
  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Smoke Test', email, password: 'e2e-smoke-password' }),
  });
  if (res.status !== 201) {
    throw new Error(`register failed: HTTP ${res.status} ${await res.text()}`);
  }
  const { token, user } = await res.json();
  return { token, user, email };
}

/**
 * Launch headless Chromium with the persisted auth store pre-seeded, so the SPA
 * boots straight into an authenticated session. Returns { browser, page, errors }
 * where `errors` collects every console error and uncaught page error.
 */
export async function launchAuthedBrowser({ user, token }) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ route: page.url(), text: msg.text().slice(0, 300) });
  });
  page.on('pageerror', (err) => {
    errors.push({ route: page.url(), text: `PAGEERROR: ${String(err).slice(0, 300)}` });
  });

  // Seed the Zustand persist payload before any app code runs.
  await page.evaluateOnNewDocument(
    (state) => {
      localStorage.setItem('perfscope-auth', JSON.stringify({ state, version: 0 }));
    },
    { user, token },
  );

  return { browser, page, errors };
}

/**
 * Delete the test user and any history rows it produced, straight through the
 * MongoDB driver — the API exposes no user-delete endpoint (see auth.routes.ts).
 */
export async function cleanupUser(email) {
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db();
    const users = await db
      .collection('users')
      .find({ email })
      .project({ _id: 1 })
      .toArray();
    const ids = users.map((u) => u._id);
    if (ids.length > 0) {
      // History.userId is stored as a string of the ObjectId; websites and competitor
      // sessions hold the ObjectId itself.
      await db.collection('histories').deleteMany({ userId: { $in: ids.map(String) } });
      await db.collection('websites').deleteMany({ userId: { $in: ids } });
      await db.collection('competitorsessions').deleteMany({ userId: { $in: ids } });
      await db.collection('users').deleteMany({ _id: { $in: ids } });
    }
  } finally {
    await client.close();
  }
}
