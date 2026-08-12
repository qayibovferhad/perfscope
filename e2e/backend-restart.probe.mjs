/**
 * Probe: an open page must recover by itself when the backend comes back.
 *
 * Opens /websites against a backend that is down (the dev server proxies to a port with
 * nothing behind it), waits for the error panel, then starts a stand-in backend on that
 * port and watches the panel clear without touching the page.
 *
 * Needs the dev server whose /api proxy points at PROBE_PORT, and nothing else on it:
 *   cd apps/web-dashboard && npx vite --config vite.probe.config.ts
 * then:  node e2e/backend-restart.probe.mjs
 */
import { createServer } from 'node:http';
import puppeteer from 'puppeteer';
import { createHmac } from 'node:crypto';

const WEB_URL    = process.env.E2E_WEB_URL ?? 'http://localhost:5199';
const PROBE_PORT = Number(process.env.PROBE_PORT ?? 3197);
const SECRET     = process.env.JWT_SECRET ?? 'probe-secret';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'probe', id: 'probe', exp: Math.floor(Date.now() / 1000) + 3600 })}`;
const token = `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
const user = { id: 'probe', sub: 'probe', name: 'Restart Probe', email: 'probe@perfscope.dev' };

const panelText = () =>
  page.evaluate(() => (document.body.innerText.match(/Could not load [^\n]*/) ?? [null])[0]);

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(
  (s) => localStorage.setItem('perfscope-auth', JSON.stringify({ state: s, version: 0 })),
  { user, token },
);

await page.goto(`${WEB_URL}/websites`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2500));
console.log('backend down  :', await panelText());

// The shapes the websites page asks for, from something that is not the real backend —
// all this probe cares about is that the page notices the recovery on its own.
const stand_in = createServer((req, res) => {
  const payload = req.url.startsWith('/api/websites/summary')
    ? { total: 0, audited: 0, avgScore: 0, needsAttention: 0 }
    : { items: [], total: 0, page: 1, limit: 12, totalPages: 1 };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
});
await new Promise((r) => stand_in.listen(PROBE_PORT, r));
console.log(`backend back  : listening on ${PROBE_PORT}, page untouched from here on`);

const t0 = Date.now();
let cleared = null;
while (Date.now() - t0 < 20_000) {
  await new Promise((r) => setTimeout(r, 500));
  if (!(await panelText())) { cleared = Date.now() - t0; break; }
}
console.log(cleared === null ? 'STILL BROKEN  : panel never cleared' : `recovered     : after ${cleared}ms, with no user action`);

stand_in.close();
await browser.close();
