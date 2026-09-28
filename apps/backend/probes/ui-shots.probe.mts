/**
 * A screenshot of every signed-in route, for looking at the product rather than reading it.
 *
 * The accessibility sweep next door proves a page is *usable*; nothing in the repo showed
 * what a page looks like, which is why twenty routes drifted into the same template
 * without anyone noticing. Same seeding as `app-a11y.probe.mts` — a throwaway account with
 * a site and three stored runs, because an empty account screenshots twenty empty states.
 *
 *   cd apps/backend && npx tsx probes/ui-shots.probe.mts [route ...]
 *     OUT=/some/dir   where the PNGs land (default: a temp dir, printed at the end)
 *     MOBILE=1        412px instead of 1350px
 *     WIDTH=1920      any desktop width (the page column has a wider cap at 2xl)
 *     FULL=1          full-page rather than the first viewport
 */
import puppeteer from 'puppeteer';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { CHROME_ARGS } from '../src/lib/chrome.js';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.model.js';
import { Website } from '../src/models/Website.model.js';
import { HistoryModel } from '../src/models/History.model.js';

const WEB_URL = process.env['WEB_URL'] ?? 'http://localhost:5173';
const MOBILE = process.env['MOBILE'] === '1';
const WIDTH = Number(process.env['WIDTH'] ?? 1350);
const FULL = process.env['FULL'] === '1';

const OUT = process.env['OUT'] ?? mkdtempSync(join(tmpdir(), 'perfscope-shots-'));
mkdirSync(OUT, { recursive: true });

const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      '/dashboard', '/app', '/compare', '/flows', '/websites', '/history',
      '/automation', '/scheduled', '/extension', ...(config.teamsEnabled ? ['/team'] : []), '/settings',
    ];

function signToken(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${body}.${createHmac('sha256', config.jwtSecret).update(body).digest('base64url')}`;
}

await mongoose.connect(config.mongoUri);

const email = `ui-shots-${Date.now()}@probe.test`;
const account = await User.create({ name: 'UI Shots', email, provider: 'email' });
const userId = String(account._id);

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/www.wikipedia.org.json', import.meta.url), 'utf8'),
);

await Website.create({ userId: account._id, url: 'https://www.wikipedia.org', name: 'Wikipedia' });

let newestAnalysisId = '';
for (let daysAgo = 0; daysAgo < 6; daysAgo++) {
  const at = new Date(Date.now() - daysAgo * 86_400_000);
  const id = randomUUID();
  if (daysAgo === 0) newestAnalysisId = id;
  await HistoryModel.create({
    analysisId: id,
    shortId: id.slice(0, 8),
    url: 'https://www.wikipedia.org/',
    normalizedUrl: 'www.wikipedia.org/',
    routePath: '/',
    userId,
    scores: { ...fixture.scores, performance: 100 - daysAgo * 7 },
    metrics: fixture.metrics,
    fullResult: { ...fixture, id },
    source: 'manual',
    createdAt: at,
    updatedAt: at,
  });
}

const user = { sub: userId, name: account.name, email, picture: '' };
const token = signToken({ ...user, exp: Math.floor(Date.now() / 1000) + 3600 });

const browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });
const page = await browser.newPage();
await page.setViewport(MOBILE
  ? { width: 412, height: 823, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { width: WIDTH, height: 940, deviceScaleFactor: 1 });

await page.evaluateOnNewDocument(
  (state) => {
    try { localStorage.setItem('perfscope-auth', JSON.stringify({ state, version: 0 })); } catch { /* opaque origin */ }
  },
  { user, token, refreshToken: null },
);

try {
  for (const route of ROUTES) {
    const target = route === '/app' ? `/history?open=${newestAnalysisId}` : route;
    await page.goto(`${WEB_URL}${target}`, { waitUntil: 'networkidle0' });
    // Routes are lazy chunks behind a Suspense spinner, and the report renders a dozen
    // panels after its data lands — a shot taken too early is a picture of a spinner.
    await new Promise((resolve) => setTimeout(resolve, route === '/app' ? 6000 : 2500));

    const name = `${route.replace(/\//g, '') || 'root'}${MOBILE ? '.mobile' : WIDTH === 1350 ? '' : `.${WIDTH}`}.png`;
    await page.screenshot({ path: join(OUT, name) as `${string}.png`, fullPage: FULL });
    console.log(`  ${route.padEnd(14)} → ${name}`);
  }
} finally {
  await browser.close();
  await Website.deleteMany({ userId: account._id });
  await HistoryModel.deleteMany({ userId });
  await User.deleteOne({ _id: account._id });
  await mongoose.disconnect();
}

console.log(`\nShots in ${OUT}`);
