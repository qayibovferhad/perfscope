/**
 * A finished audit announces itself two ways — a toast where the reader was looking, and a
 * card in the sidebar to come back to. Neither is worth anything on the pages that *are*
 * the result: the analyzer draws the scores as they arrive, and the compare page is two of
 * them side by side. A notification for something already on screen is how people learn to
 * ignore notifications, and a card offering "open the report" while the report is open
 * points at the page it is drawn on.
 *
 * What is worth proving is the negative and its control together: silence on /app and
 * /compare, and — with the same probe, the same run, the same selectors — the announcement
 * still arriving on an ordinary page. A probe that only asserts absence passes just as
 * happily when it is looking in the wrong place.
 *
 *   node e2e/result-route-silence.probe.mjs
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  WEB_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep,
} from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 3394;
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

/** Both announcements, read out of the DOM — the store is a module singleton a probe gets
 *  its own empty copy of, so what is rendered is the only account worth asserting. */
const announcements = (page) => page.evaluate(() => ({
  toast: [...document.querySelectorAll('.ps-toast')]
    .some((t) => /audit finished/i.test(t.innerText)),
  card: [...document.querySelectorAll('aside button')]
    .some((b) => /finished · open the report/i.test(b.innerText)),
}));

/** The live run's row, identified by its progress bar — the only inline width in the aside. */
const running = (page) => page.evaluate(() =>
  [...document.querySelectorAll('aside button')].some((b) => b.querySelector('span[style*="width"]')));

const clickNav = (page, label) => page.evaluate((text) => {
  const link = [...document.querySelectorAll('aside a')].find((a) => a.textContent?.trim() === text);
  link?.click();
  return Boolean(link);
}, label);

/** Start a run from the analyzer's own form, then wait for the sidebar to show it. */
async function startRun(page) {
  await page.goto(`${WEB_URL}/app?url=${encodeURIComponent(TARGET)}`, { waitUntil: 'networkidle0' });
  for (let i = 0; i < 40; i++) {
    if (await running(page)) return true;
    await sleep(500);
  }
  return false;
}

/** Wait for the run to leave the sidebar — that is the moment the result landed. */
async function waitForFinish(page) {
  for (let i = 0; i < 240; i++) {
    if (!(await running(page))) return true;
    await sleep(500);
  }
  return false;
}

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  // ─── Finishing while the compare page is open ──────────────────────────────
  check(await startRun(page), 'an audit starts and shows in the sidebar');
  check(await clickNav(page, 'Compare'), 'the sidebar offers the compare page');
  await sleep(1500);
  check(new URL(page.url()).pathname === '/compare', `and it is open (${new URL(page.url()).pathname})`);

  check(await waitForFinish(page), 'the run finishes while the compare page is open');
  // A moment for anything that was going to be drawn to be drawn — asserting absence
  // immediately would pass on nothing more than being early.
  await sleep(2500);

  const onCompare = await announcements(page);
  check(onCompare.toast === false, 'no toast on the compare page');
  check(onCompare.card === false, 'and no finished-audit card in the sidebar');

  // ─── Still silent on the analyzer itself ───────────────────────────────────
  check(await startRun(page), 'a second audit starts');
  check(await waitForFinish(page), 'and finishes with the analyzer open');
  await sleep(2500);

  const onAnalyzer = await announcements(page);
  check(onAnalyzer.toast === false, 'no toast on the analyzer — the scores are on screen');
  check(onAnalyzer.card === false, 'and no card offering the page it is drawn on');

  // ─── The control: an ordinary page still gets told ─────────────────────────
  // Same selectors, same run, same probe. Without this the two blocks above would pass
  // just as happily if the announcement had been removed altogether.
  check(await startRun(page), 'a third audit starts');
  check(await clickNav(page, 'My Websites'), 'and the reader goes somewhere that is not a report');
  await sleep(1200);
  check(await waitForFinish(page), 'the run finishes while they are there');

  let told = { toast: false, card: false };
  for (let i = 0; i < 30; i++) {
    told = await announcements(page);
    if (told.toast && told.card) break;
    await sleep(500);
  }
  check(told.toast, 'a toast announces it on an ordinary page');
  check(told.card, 'and the sidebar keeps a card to come back to');

  // ─── Going back to the analyzer hides the card rather than losing it ───────
  // Hidden, not dismissed: the result is still unread, and it has to be waiting again the
  // moment the reader goes anywhere else.
  check(await clickNav(page, 'New Audit'), 'the reader opens the analyzer');
  await sleep(1500);
  check((await announcements(page)).card === false, 'the card is not drawn there');
  check(await clickNav(page, 'My Websites'), 'and they leave again');
  await sleep(1500);
  check((await announcements(page)).card === true, 'the card is waiting where it was');

  const noisy = errors.filter((e) => !/favicon/i.test(e));
  check(noisy.length === 0, `no console errors (${noisy.length})`);
  if (noisy.length) console.log(noisy.slice(0, 5));
} finally {
  await browser.close();
  await cleanupUser(email);
  fixtureServer.close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
