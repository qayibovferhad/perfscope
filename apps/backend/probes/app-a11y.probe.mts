/**
 * PerfScope's own accessibility, on the pages behind the login.
 *
 * `self-audit.probe.mts` measures `/` — the only route a logged-out visitor sees — so every
 * screen anybody actually works in has never been audited. This walks the signed-in routes
 * and reports what Lighthouse finds on each.
 *
 * **Snapshot mode**, which is the point: a snapshot audits the DOM as it stands, with no
 * navigation and no timing, so it can be taken after a session has been seeded into the
 * page. It is the same mode the new flows feature uses for its final state — this probe is
 * the first thing to eat that dog food.
 *
 * **Seeded with data**, which is the half that matters: an empty account renders empty
 * states, and the accessibility problems of this product live in the things that only
 * appear once there is something to draw — a chart, a table of runs, a report full of
 * audits. A throwaway account is created, given a site and a real stored result (one of
 * the captured fixtures), and removed again at the end.
 *
 * Reports rather than asserts: it is a measuring instrument for a UI pass, and a threshold
 * baked in here would be a number nobody agreed to.
 *
 *   cd apps/backend && npx tsx probes/app-a11y.probe.mts [route ...]
 */
import puppeteer from 'puppeteer';
import { startFlow } from 'lighthouse';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { CHROME_ARGS } from '../src/lib/chrome.js';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.model.js';
import { Website } from '../src/models/Website.model.js';
import { HistoryModel } from '../src/models/History.model.js';

const WEB_URL = process.env['WEB_URL'] ?? 'http://localhost:5173';

/** `MOBILE=1` runs the same sweep at a phone's width — the layout work landed there first
 *  and its accessibility never followed. */
const MOBILE = process.env['MOBILE'] === '1';

const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/dashboard', '/app', '/compare', '/flows', '/websites', '/history', '/automation', '/team', '/settings'];

/** A token for a throwaway account, signed the way the middleware reads it (`sub`). */
function signToken(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${body}.${createHmac('sha256', config.jwtSecret).update(body).digest('base64url')}`;
}

// ─── A throwaway account with something on every screen ──────────────────────
await mongoose.connect(config.mongoUri);

const email = `a11y-probe-${Date.now()}@probe.test`;
const account = await User.create({ name: 'A11y Probe', email, provider: 'email' });
const userId = String(account._id);

const fixture = JSON.parse(readFileSync(new URL('./fixtures/www.wikipedia.org.json', import.meta.url), 'utf8'));

await Website.create({ userId: account._id, url: 'https://www.wikipedia.org', name: 'Wikipedia' });

// Three runs across three days, so the charts and the history table have a shape rather
// than a single point — a one-row table hides every problem a table has.
let newestAnalysisId = '';
for (let daysAgo = 0; daysAgo < 3; daysAgo++) {
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
    scores:  { ...fixture.scores, performance: 100 - daysAgo * 7 },
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
  ? { width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true }
  : { width: 1350, height: 940, deviceScaleFactor: 1 });

// Seeded before any app code runs, exactly as the e2e helper does it — the account has no
// data, which is fine: empty states are screens too, and nobody has audited those either.
await page.evaluateOnNewDocument(
  (state) => {
    try { localStorage.setItem('perfscope-auth', JSON.stringify({ state, version: 0 })); } catch { /* opaque origin */ }
  },
  { user, token, refreshToken: null },
);

interface Failure { id: string; title: string; items: number; nodes: string[] }
interface Row { route: string; score: number | null; failures: Failure[] }
const rows: Row[] = [];

try {
  for (const route of ROUTES) {
    // The analyzer is an empty form until a result is loaded, and the report is the densest
    // screen in the product — auditing the form would be auditing the wrong page. The
    // extension's own deep link does the loading, so this takes the door that already
    // exists rather than reaching into a store.
    const target = route === '/app' ? `/history?open=${newestAnalysisId}` : route;
    await page.goto(`${WEB_URL}${target}`, { waitUntil: 'networkidle0' });
    // Routes are lazy chunks behind a Suspense spinner; auditing during that measures the
    // spinner's accessibility, which is not the question.
    await new Promise((resolve) => setTimeout(resolve, route === '/app' ? 5000 : 2500));

    const flow = await startFlow(page, { name: route, flags: { screenEmulation: { disabled: true } } });
    await flow.snapshot({ name: route });
    const result = await flow.createFlowResult();
    const lhr = result.steps[0]!.lhr;

    const score = lhr.categories['accessibility']?.score ?? null;
    const failures = Object.entries(lhr.audits)
      .filter(([, audit]) => audit.score !== null && (audit.score ?? 1) < 1)
      .filter(([id]) => (lhr.categories['accessibility']?.auditRefs ?? []).some(ref => ref.id === id))
      .map(([id, audit]) => {
        const items = ((audit.details as { items?: { node?: { selector?: string; snippet?: string } }[] } | undefined)?.items) ?? [];
        return {
          id,
          title: audit.title ?? id,
          items: items.length,
          // The selector is the whole point of running this: "one element fails" is a
          // number, and the element is the fix.
          nodes: items.slice(0, 3).map(item => `${item.node?.selector ?? '?'}  ${String(item.node?.snippet ?? '').slice(0, 120)}`),
        };
      });

    rows.push({ route, score: score === null ? null : Math.round(score * 100), failures });
    console.log(`  ${route.padEnd(12)} ${String(rows.at(-1)!.score).padStart(3)}  ${failures.map(f => `${f.id}(${f.items})`).join(' ') || '—'}`);
  }
} finally {
  await browser.close();
  await HistoryModel.deleteMany({ userId });
  await Website.deleteMany({ userId: account._id });
  await User.deleteOne({ _id: account._id });
  await mongoose.disconnect();
}

// ─── What to fix, ordered by how many screens it appears on ──────────────────
const byAudit = new Map<string, { title: string; routes: string[]; items: number; nodes: string[] }>();
for (const row of rows) {
  for (const failure of row.failures) {
    const entry = byAudit.get(failure.id) ?? { title: failure.title, routes: [], items: 0, nodes: [] };
    entry.routes.push(row.route);
    entry.items += failure.items;
    entry.nodes.push(...failure.nodes);
    byAudit.set(failure.id, entry);
  }
}

console.log('\n  ── across the app ──');
for (const [id, entry] of [...byAudit].sort((a, b) => b[1].routes.length - a[1].routes.length)) {
  console.log(`  ${id} — ${entry.title}`);
  console.log(`    ${entry.routes.length} route(s): ${entry.routes.join(', ')} · ${entry.items} element(s)`);
  for (const node of entry.nodes) console.log(`      ${node}`);
}

const scored = rows.map(r => r.score).filter((s): s is number => s !== null);
console.log(`\n  worst ${Math.min(...scored)} · best ${Math.max(...scored)} · ${byAudit.size} distinct failures`);
