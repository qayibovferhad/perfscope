/**
 * Probe: what the dashboard, websites and history pages show when the backend has no
 * database — the state in which every list is legitimately empty and the pages used to
 * report "the server did not respond" instead.
 *
 * Needs the probe pair: a backend on 3197 started with an unreachable MONGODB_URI, and the
 * dev server that proxies to it —
 *   cd apps/backend && PORT=3197 MONGODB_URI=mongodb://127.0.0.1:27099/x JWT_SECRET=probe-secret npx tsx src/index.ts
 *   cd apps/web-dashboard && npx vite --config vite.probe.config.ts
 * then:  node e2e/empty-account.probe.mjs
 */
import { launchAuthedBrowser, signToken, sleep, bodyText } from './helpers.mjs';

// Its own web URL: this probe drives the vite instance that proxies to the no-database
// backend, not the ordinary dev server.
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5199';
const SECRET  = process.env.JWT_SECRET ?? 'probe-secret';
const ROUTES  = ['/dashboard', '/websites', '/history', '/automation'];

// Registering is impossible here — there is no database to register into.
const userId = '6a7c493cf7d8daef1a06d52f';
const token  = signToken({ sub: userId, id: userId, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
const user   = { id: userId, name: 'Storage Probe', email: 'probe@perfscope.dev' };

const { browser, page } = await launchAuthedBrowser({ user, token });

const statuses = [];
page.on('response', (res) => {
  if (/\/api\//.test(res.url())) statuses.push(`${res.status()} ${res.url().split('/api/')[1].split('?')[0]}`);
});

for (const route of ROUTES) {
  statuses.length = 0;
  const t0 = Date.now();
  await page.goto(`${WEB_URL}${route}`, { waitUntil: 'networkidle0' });
  await sleep(1200);
  const text = await bodyText(page);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(`\n=== ${route} (${Date.now() - t0}ms) ===`);
  console.log('api      :', [...new Set(statuses)].sort());
  console.log('banner   :', lines.some((l) => /Storage is offline/i.test(l)) ? 'shown' : 'MISSING');
  console.log('error    :', lines.filter((l) => /could not load|did not respond|unavailable/i.test(l)));
  console.log('empty    :', lines.filter((l) => /no (websites|history|audits|sites)/i.test(l)));
  await page.screenshot({ path: `${process.env.SHOT_DIR ?? '/tmp'}/storage-off${route.replace(/\//g, '-')}.png` });
}

await browser.close();
