/**
 * Probe: what the dashboard, websites and history pages show when the backend has no
 * database — the state in which every list is legitimately empty and the pages used to
 * report "the server did not respond" instead.
 *
 * Point E2E_WEB_URL at a dev server proxied to a backend started without MONGODB_URI.
 * Run with that pair up:  E2E_WEB_URL=http://localhost:5199 node e2e/empty-account.probe.mjs
 */
import puppeteer from 'puppeteer';
import { createHmac } from 'node:crypto';

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5199';
const SECRET  = process.env.JWT_SECRET ?? 'probe-secret';
const ROUTES  = ['/dashboard', '/websites', '/history', '/automation'];

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

/** HS256 by hand: registering is impossible here (no database), and this file is not
 *  worth a dependency the rest of the suite does not have. */
function signToken(payload) {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}

const userId = '6a7c493cf7d8daef1a06d52f';
const token  = signToken({ sub: userId, id: userId, exp: Math.floor(Date.now() / 1000) + 3600 });
const user   = { id: userId, name: 'Storage Probe', email: 'probe@perfscope.dev' };

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(
  (state) => localStorage.setItem('perfscope-auth', JSON.stringify({ state, version: 0 })),
  { user, token },
);

const statuses = [];
page.on('response', (res) => {
  if (/\/api\//.test(res.url())) statuses.push(`${res.status()} ${res.url().split('/api/')[1].split('?')[0]}`);
});

for (const route of ROUTES) {
  statuses.length = 0;
  const t0 = Date.now();
  await page.goto(`${WEB_URL}${route}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`\n=== ${route} (${Date.now() - t0}ms) ===`);
  console.log('api      :', [...new Set(statuses)].sort());
  console.log('banner   :', lines.some((l) => /Storage is offline/i.test(l)) ? 'shown' : 'MISSING');
  console.log('error    :', lines.filter((l) => /could not load|did not respond|unavailable/i.test(l)));
  console.log('empty    :', lines.filter((l) => /no (websites|history|audits|sites)/i.test(l)));
  await page.screenshot({ path: `${process.env.SHOT_DIR ?? '/tmp'}/storage-off${route.replace(/\//g, '-')}.png` });
}

await browser.close();
