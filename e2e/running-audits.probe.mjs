/**
 * An audit takes tens of seconds, and nobody sits and watches it — they start one and go
 * look at something else. The run then existed only on the page that started it, and that
 * page, once left, gave no sign it had ever been running. `adoptRunning` had been there to
 * re-attach to a live run since long before this; nothing ever told anyone there *was* one.
 *
 * The two things worth proving are the two that a screenshot cannot show: that the
 * indicator keeps moving after the page that started the run is gone — its listeners went
 * with it, so the tracking cannot be built on them — and that it disappears on its own when
 * the run finishes, rather than leaving a permanent claim that something is happening.
 *
 *   node e2e/running-audits.probe.mjs [outDir]
 */
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  WEB_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep, bodyText,
} from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? '/tmp/perfscope-running-audits';
mkdirSync(OUT, { recursive: true });

const PORT = 3392;
const html = readFileSync(join(HERE, 'fixtures', 'inaccessible.html'));
const fixtureServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
});
await new Promise((r) => fixtureServer.listen(PORT, r));
const TARGET = `http://localhost:${PORT}/`;

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/**
 * Read through the DOM, not the store.
 *
 * The store is a module singleton and a probe that imports it through Vite gets its *own*
 * copy — an empty one, which reads as "no runs" no matter what the page is showing. What
 * the pill renders is the only account of this that a person ever sees, so it is the one
 * worth asserting.
 */
const pill = (page) => page.evaluate(() => {
  // Identified by its progress bar — the only inline width in the sidebar — rather than by
  // its text, which changes every few seconds as the server reports a new stage.
  const el = [...document.querySelectorAll('aside button')]
    .find((b) => b.querySelector('span[style*="width"]'));
  if (!el) return null;
  const bar = el.querySelector('span[style*="width"]');
  const width = Number((bar?.getAttribute('style') ?? '').match(/width:\s*([\d.]+)%/)?.[1] ?? 0);
  return { text: el.innerText.replace(/\n/g, ' · '), width };
});

/** Navigate the way a person does — the store lives in memory and a reload is a new app. */
const clickNav = (page, label) => page.evaluate((text) => {
  const link = [...document.querySelectorAll('aside a')].find((a) => a.textContent?.trim() === text);
  link?.click();
  return Boolean(link);
}, label);

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  // ─── Nothing running ───────────────────────────────────────────────────────
  await page.goto(`${WEB_URL}/dashboard`, { waitUntil: 'networkidle0' });
  await sleep(1200);
  check(await pill(page) === null, 'an idle account shows no running-audit pill');

  // ─── Start one, then leave the page ────────────────────────────────────────
  await page.goto(`${WEB_URL}/app?url=${encodeURIComponent(TARGET)}`, { waitUntil: 'networkidle0' });
  await sleep(2500);

  const onAnalyzer = await pill(page);
  console.log(`  pill: ${onAnalyzer?.text} (${onAnalyzer?.width}%)`);
  check(!!onAnalyzer, 'starting an audit puts a pill in the sidebar');
  check(/localhost/.test(onAnalyzer?.text ?? ''), 'naming the URL being audited');

  // The whole point: leave the page. Its listeners go with it, so anything built on them
  // stops here. Navigated by clicking, because a reload is a new application and an
  // in-memory run legitimately does not survive one.
  check(await clickNav(page, 'My Websites'), 'the sidebar offers a way to another route');
  await sleep(1500);
  check(new URL(page.url()).pathname === '/websites', `and takes it (${new URL(page.url()).pathname})`);

  const awayPill = await pill(page);
  console.log(`  after navigating: ${awayPill?.text} (${awayPill?.width}%)`);
  check(!!awayPill, 'the pill is still there on another route');
  await page.screenshot({ path: `${OUT}/running-elsewhere.png` });

  // Progress has to keep moving — a frozen bar is the exact failure this design avoids.
  const before = awayPill?.width ?? 0;
  await sleep(7000);
  const after = (await pill(page))?.width ?? 0;
  console.log(`  progress ${before}% → ${after}%`);
  check(after > before || after >= 85, `and keeps moving with the page gone (${before}% → ${after}%)`);

  // ─── Clicking it goes back to the run ──────────────────────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('aside button')]
      .find((b) => b.querySelector('span[style*="width"]'));
    el?.click();
  });
  await sleep(1500);
  check(new URL(page.url()).pathname === '/app', `clicking the pill goes back to the run (${new URL(page.url()).pathname})`);

  // ─── It clears itself ──────────────────────────────────────────────────────
  let cleared = false;
  for (let i = 0; i < 240; i++) {
    if (await pill(page) === null) { cleared = true; break; }
    await sleep(500);
  }
  check(cleared, 'the pill disappears when the audit finishes');
  check(/opportunities & diagnostics/i.test(await bodyText(page)), 'while the report lands as usual');

  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map((e) => e.text).join(' | ') || 'none'})`);
  console.log(`  screenshots → ${OUT}`);
} finally {
  await browser.close();
  await cleanupUser(email);
  fixtureServer.close();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
