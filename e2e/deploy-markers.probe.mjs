/**
 * Deploy markers: the chart saying *why* a line moved.
 *
 * The claim under test is placement, not presence. A marker must land on the first run
 * measured *after* the release — a line drawn on an earlier run invites blaming a deploy
 * for a number taken before it shipped, which is worse than drawing nothing.
 *
 * Six runs are seeded across six days with two deploys between them, so there is exactly
 * one correct answer and several plausible wrong ones.
 *
 *   node e2e/deploy-markers.probe.mjs [outDir]
 */
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { MongoClient } from 'mongodb';
import {
  WEB_URL, BACKEND_URL, MONGODB_URI, registerUser, cleanupUser,
  launchAuthedBrowser, waitForServers, sleep,
} from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-deploy-markers';
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

const HOST = 'deploys.probe.test';
const day = (n) => new Date(Date.now() - n * 86_400_000);

await waitForServers();
const { token, user, email } = await registerUser();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

const site = (await (await fetch(`${BACKEND_URL}/api/websites`, {
  method: 'POST', headers: H, body: JSON.stringify({ url: `https://${HOST}`, name: HOST }),
})).json()).data;

// Six runs, oldest first: days 6 → 1.
const mongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await mongo.connect();
await mongo.db().collection('histories').insertMany([6, 5, 4, 3, 2, 1].map((d, i) => ({
  analysisId: `dep-probe-${i}`, shortId: `dp${i}`,
  url: `https://${HOST}/`, normalizedUrl: `${HOST}/`, routePath: '/',
  userId: String(user.sub ?? user.id),
  scores:  { performance: 80, accessibility: 90, bestPractices: 90, seo: 90 },
  metrics: { fcp: 1000, lcp: 2000 + i * 100, tbt: 100 + i * 10, cls: 0.05, si: 1500, tti: 2500 },
  fullResult: { id: `dep-probe-${i}`, url: `https://${HOST}/` },
  source: 'manual', createdAt: day(d), updatedAt: day(d),
})));
await mongo.close();

const post = (b) => fetch(`${BACKEND_URL}/api/websites/${site._id}/deploys`, {
  method: 'POST', headers: H, body: JSON.stringify(b),
}).then(r => r.json().then(j => ({ status: r.status, data: j.data })));

// ── The endpoint ─────────────────────────────────────────────────────────────
const bare = await post({});
check(bare.status === 201 && !!bare.data.at, 'a body-less POST still records a deploy at now');

// 3.5 days ago — after run 3 (4 days ago), before run 4 (3 days ago), so it belongs to run 4.
const mid = await post({ ref: 'a'.repeat(40), label: 'v2.0.0', at: new Date(Date.now() - 3.5 * 86_400_000).toISOString() });
check(mid.status === 201 && mid.data.label === 'v2.0.0', 'a labelled deploy records its label');

const retry = await post({ ref: 'a'.repeat(40), label: 'v2.0.0', at: mid.data.at });
check(retry.data._id === mid.data._id, 'the same ref twice is one marker, not two (a retried pipeline step)');

check((await post({ at: 'nonsense' })).status === 400, 'an unparseable date is refused rather than stored');

const { token: other, email: otherEmail } = await registerUser();
const forbidden = await fetch(`${BACKEND_URL}/api/websites/${site._id}/deploys`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${other}` }, body: '{}',
});
check(forbidden.status === 404, `another account cannot mark a deploy on this site (${forbidden.status})`);
await cleanupUser(otherEmail);

// ── The CLI ──────────────────────────────────────────────────────────────────
const cli = (args) => {
  try {
    return { out: execFileSync('node', ['packages/cli/bin/cli.js', ...args], {
      encoding: 'utf8', env: { ...process.env, PERFSCOPE_API_KEY: token }, timeout: 30_000,
    }), code: 0 };
  } catch (e) {
    return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status };
  }
};

const viaCli = cli(['deploy', '--site', `https://${HOST}`, '--ref', 'b'.repeat(40),
  '--label', 'v2.1.0', '--at', new Date(Date.now() - 1.5 * 86_400_000).toISOString(),
  '--api-url', BACKEND_URL]);
check(/Deploy recorded/.test(viaCli.out) && viaCli.code === 0, `the CLI records one (${viaCli.out.trim().split('\n')[0] ?? ''})`);

const unknown = cli(['deploy', '--site', 'https://nowhere.probe.test', '--api-url', BACKEND_URL]);
check(unknown.code === 2 && /No website matching/.test(unknown.out), 'and refuses a site the account does not have');

const unreachable = cli(['deploy', '--site', `https://${HOST}`, '--api-url', 'http://127.0.0.1:1']);
check(unreachable.code === 0, 'a backend it cannot reach never fails the build');

// ── The chart ────────────────────────────────────────────────────────────────
const { browser, page, errors } = await launchAuthedBrowser({ user, token });
try {
  await page.goto(`${WEB_URL}/history`, { waitUntil: 'networkidle0' });
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/history-markers.png`, fullPage: true });

  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('svg text')].map(t => t.textContent?.trim() ?? ''));
  check(labels.includes('v2.0.0'), `the release is labelled on the chart (${labels.filter(Boolean).slice(0, 12).join(' ')})`);
  check(labels.includes('v2.1.0'), 'and so is the second one');

  // Placement: the marker's line must sit at the same x as the run that first felt it.
  // Runs are 6,5,4,3,2,1 days old; the v2.0.0 deploy is 3.5 days old, so the first run
  // that could have measured it is the 3-day-old one — run 4 of 6.
  const geometry = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find(s => s.querySelector('.recharts-reference-line'));
    if (!svg) return null;
    const dots = [...svg.querySelectorAll('.recharts-area-dots circle, .recharts-layer circle')]
      .map(c => Number(c.getAttribute('cx'))).filter(Number.isFinite);
    const lines = [...svg.querySelectorAll('.recharts-reference-line line')]
      .map(l => Number(l.getAttribute('x1')));
    return { dots: [...new Set(dots)].sort((a, b) => a - b), lines: lines.sort((a, b) => a - b) };
  });

  check(!!geometry && geometry.lines.length === 2, `both markers are drawn (${geometry?.lines.length ?? 0})`);
  if (geometry && geometry.dots.length >= 6) {
    const runs = geometry.dots.slice(0, 6);
    const nearest = geometry.lines.map(x => runs.reduce((best, r, i) =>
      Math.abs(r - x) < Math.abs(runs[best] - x) ? i : best, 0));
    console.log(`  runs at x=[${runs.map(Math.round).join(', ')}]  markers at x=[${geometry.lines.map(Math.round).join(', ')}]`);
    check(nearest[0] === 3, `v2.0.0 sits on the first run measured after it (run ${nearest[0] + 1} of 6, expected 4)`);
    check(nearest[1] === 5, `v2.1.0 likewise (run ${nearest[1] + 1} of 6, expected 6)`);
  } else {
    check(false, 'the run dots could be located for a placement check');
  }

  const real = errors.filter(e => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map(e => e.text).join(' | ') || 'none'})`);
  console.log(`  screenshots → ${OUT}`);
} finally {
  await browser.close();
  const cleanup = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await cleanup.connect();
  await cleanup.db().collection('histories').deleteMany({ userId: String(user.sub ?? user.id) });
  await cleanup.db().collection('deploys').deleteMany({ websiteId: { $exists: true } });
  await cleanup.close();
  await cleanupUser(email);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
