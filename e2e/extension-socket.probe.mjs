/**
 * Probe: does the popup actually audit over the socket now?
 *
 * It used POST /api/analyze, which the server hangs up on at 70s while an audit may take
 * four minutes. This drives the real popup — extension loaded into Chrome, a real token in
 * browser.storage.local — clicks Analyze, and watches for the live progress the REST path
 * could never show, then for scores.
 *
 * Needs a built extension and a running backend:
 *   pnpm --filter @perfscope/chrome-extension build
 */
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer';
import { BACKEND_URL, registerUser, cleanupUser, waitForBackend, sleep } from './helpers.mjs';

const DIST = new URL('../apps/chrome-extension/.output/chrome-mv3/', import.meta.url).pathname;
JSON.parse(readFileSync(`${DIST}manifest.json`, 'utf8')); // fails loudly if not built

await waitForBackend();
const { token, email } = await registerUser();

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage',
         `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

try {
  await sleep(1500);
  const target = browser.targets().find((t) => t.url().startsWith('chrome-extension://'));
  if (!target) throw new Error('extension did not register — is it built?');
  const id = new URL(target.url()).host;

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

  // Seed storage the way a real login would.
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.evaluate(async (t, url) => {
    await chrome.storage.local.set({ token: t, backendUrl: url });
  }, token, BACKEND_URL);

  // The popup audits whatever tab is in front of it, and headless Chrome has no ordinary
  // page open — so stand in for the tab query. Everything downstream of it (the socket
  // run, the progress, the scores) is the real code path.
  await page.evaluateOnNewDocument(() => {
    const answer = [{ url: 'https://example.com', active: true }];
    // @ts-expect-error — test double
    chrome.tabs.query = (_q, cb) => (cb ? cb(answer) : Promise.resolve(answer));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1200);
  const typed = true;

  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /analyze/i.test(b.textContent ?? ''));
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  });
  console.log(`url input present: ${typed} · analyze clicked: ${clicked}`);
  if (!clicked) { console.log('(no active tab in headless Chrome — popup had no URL to audit)'); }

  // Watch for progress text the REST path never had, then for a score.
  let sawProgress = null;
  for (let i = 0; i < 120 && clicked; i++) {
    const t = await page.evaluate(() => document.body.innerText);
    if (!sawProgress) {
      const m = t.match(/\d+%/);
      if (m) { sawProgress = t.split('\n').find((l) => l.includes('%'))?.trim() ?? m[0]; }
    }
    if (/performance/i.test(t) && /\b(100|9\d|8\d)\b/.test(t)) break;
    await sleep(1000);
  }
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 220));
  console.log('live progress seen :', sawProgress ?? '(none)');
  console.log('popup after run    :', body);
  console.log('errors             :', errors.length ? errors.join(' | ') : 'none');
} finally {
  await browser.close();
  await cleanupUser(email);
}
