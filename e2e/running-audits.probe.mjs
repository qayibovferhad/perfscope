/**
 * An audit takes tens of seconds, and nobody sits and watches it — they start one and go
 * look at something else. The run then existed only on the page that started it, and that
 * page, once left, gave no sign it had ever been running. `adoptRunning` had been there to
 * re-attach to a live run since long before this; nothing ever told anyone there *was* one.
 *
 * The things worth proving are the ones a screenshot cannot show: that the indicator keeps
 * moving after the page that started the run is gone — its listeners went with it, so the
 * tracking cannot be built on them — that it disappears on its own when the run finishes,
 * that going back to an adopted run shows the *run's* clock rather than starting a new one,
 * and that a run finishing while the reader is on another page says so.
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

  // ─── Finishing while nobody is looking ─────────────────────────────────────
  // Still on /websites here, deliberately: this is the case the analyzer's own listeners
  // cannot cover, because it is not mounted.
  let announced = null;
  for (let i = 0; i < 240; i++) {
    announced = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.ps-toast')]
        .find((t) => /audit finished/i.test(t.innerText));
      return el ? el.innerText.replace(/\n/g, ' · ') : null;
    });
    if (announced) break;
    await sleep(500);
  }
  console.log(`  toast: ${announced}`);
  check(!!announced, 'a run that finishes on another page announces itself');
  check(/performance \d+/i.test(announced ?? ''), 'with the score it landed on');
  check(/localhost/.test(announced ?? ''), 'and the page it was about');
  check(/view report/i.test(announced ?? ''), 'offering a way to the report');
  await page.screenshot({ path: `${OUT}/finished-elsewhere.png` });

  // The report has to be *there* when the offer is taken up — the page that would normally
  // have kept it was not mounted when the audit finished.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.ps-toast button')]
      .find((b) => /view report/i.test(b.textContent ?? ''));
    btn?.click();
  });
  await sleep(1800);
  check(new URL(page.url()).pathname === '/app', 'the action navigates to the analyzer');
  check(/opportunities & diagnostics/i.test(await bodyText(page)), 'and the report is there rather than an empty form');

  console.log(`\n  (a second run, to check the pill and the clock while it is live)`);
  await page.evaluate(() => {
    const input = document.querySelector('input[placeholder^="https"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'http://localhost:3392/');
    input?.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('button[type="submit"]')].at(-1)?.click();
  });
  await sleep(2500);
  check(await pill(page) !== null, 'a fresh run puts the pill back');
  check(await clickNav(page, 'My Websites'), 'and can be left again');
  await sleep(1200);

  // ─── Clicking it goes back to the run ──────────────────────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('aside button')]
      .find((b) => b.querySelector('span[style*="width"]'));
    el?.click();
  });
  await sleep(1500);
  check(new URL(page.url()).pathname === '/app', `clicking the pill goes back to the run (${new URL(page.url()).pathname})`);

  // ─── The clock is the run's, not the page's ────────────────────────────────
  // Adopting a run used to show no elapsed time at all: it began before this page did, and
  // counting from the mount would be a wrong number rather than a missing one. The store
  // knows when it really started.
  const clock = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')]
      .map((e) => e.textContent?.trim() ?? '')
      .find((t) => /^\d+:\d{2}$/.test(t));
    return el ?? null;
  });
  console.log(`  elapsed on the adopted run: ${clock}`);
  check(clock !== null, 'the adopted run shows an elapsed clock');
  check(clock !== '0:00' && clock !== '0:01', `counting from when the run began, not from the click (${clock})`);

  // ─── It clears itself ──────────────────────────────────────────────────────
  let cleared = false;
  for (let i = 0; i < 240; i++) {
    if (await pill(page) === null) { cleared = true; break; }
    await sleep(500);
  }
  check(cleared, 'the pill disappears when the audit finishes');
  check(/opportunities & diagnostics/i.test(await bodyText(page)), 'while the report lands as usual');

  // ─── Stop actually stops it ────────────────────────────────────────────────
  // Two moments where the page has not yet been told the run's id — it learns that from a
  // progress event, which in Fast mode can be twenty seconds away. Stop pressed in either
  // window used to reset the form and leave the audit running; the pill was the only thing
  // that said so, by carrying on counting.
  for (const [label, adopt] of [['straight after starting', false], ['straight after adopting a run', true]]) {
    await page.evaluate((url) => {
      const input = document.querySelector('input[placeholder^="https"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, url);
      input?.dispatchEvent(new Event('input', { bubbles: true }));
      [...document.querySelectorAll('button[type="submit"]')].at(-1)?.click();
    }, TARGET);

    if (adopt) {
      // Leave and come back through the pill, so the page adopts a run it did not start.
      await sleep(3000);
      await clickNav(page, 'My Websites');
      await sleep(1200);
      await page.evaluate(() => {
        [...document.querySelectorAll('aside button')].find((b) => b.querySelector('span[style*="width"]'))?.click();
      });
      await sleep(600);
    } else {
      await sleep(350);
    }

    const stopped = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /^Stop$/i.test(b.textContent?.trim() ?? ''));
      btn?.click();
      return Boolean(btn);
    });
    check(stopped, `Stop is offered ${label}`);
    await sleep(4000);
    check(await pill(page) === null, `and stopping ${label} really stops the run`);
    await sleep(1000);
  }

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
