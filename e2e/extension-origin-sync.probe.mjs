/**
 * Probe: does the extension pick up a JWT from a self-hosted dashboard origin?
 *
 * content.ts is declared statically for localhost:5173 and perfscope.app only, so anyone
 * running the dashboard anywhere else got no token sync at all — the popup sat signed out
 * with nothing in the UI to explain it. The background worker now registers a dynamic copy
 * of the same content script for whatever origin the settings drawer was pointed at.
 *
 * This serves a fake dashboard on a port that is deliberately *not* one of the static
 * matches, seeds it with a perfscope-auth payload the way a real login would, and checks
 * whether the extension ends up holding the token.
 *
 * Needs a built extension:
 *   pnpm --filter @perfscope/chrome-extension build
 *   node e2e/extension-origin-sync.probe.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, cpSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import { sleep } from './helpers.mjs';

const BUILT = new URL('../apps/chrome-extension/.output/chrome-mv3/', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(`${BUILT}manifest.json`, 'utf8')); // fails loudly if not built

const PORT = 4317; // not 5173, and not perfscope.app — that is the whole point
const WEB_URL = `http://localhost:${PORT}`;
const TOKEN = 'probe-token-abc123';

/**
 * Load a copy of the build with the probe origin pre-granted.
 *
 * `chrome.permissions.request()` renders a confirmation bubble, and headless Chrome cannot
 * show one, so the promise never settles and the probe hangs. Granting the origin in the
 * manifest stands in for the click the user makes on Save — everything downstream of that
 * grant (the dynamic registration, the sync, the cleanup) is the real code path.
 */
const DIST = mkdtempSync(join(tmpdir(), 'perfscope-ext-'));
cpSync(BUILT, DIST, { recursive: true });
writeFileSync(join(DIST, 'manifest.json'), JSON.stringify({
  ...manifest,
  host_permissions: [...manifest.host_permissions, `${WEB_URL}/*`],
}, null, 2));

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<!doctype html><title>Fake PerfScope</title><h1>self-hosted dashboard</h1>');
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage',
         `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

/** Run code in the extension's service worker, where the browser.* APIs live. */
async function inWorker(fn, ...args) {
  const target = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('background'),
    { timeout: 15_000 });
  const worker = await target.worker();
  return worker.evaluate(fn, ...args);
}

/**
 * The popup's page context. Messages must be sent from here rather than the worker:
 * `runtime.sendMessage` from the background does not reach the background's own listener.
 */
let popup;
async function openPopup() {
  const target = browser.targets().find((t) => t.url().startsWith('chrome-extension://'));
  if (!target) throw new Error('extension did not register — is it built?');
  const id = new URL(target.url()).host;
  popup = await browser.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await sleep(500);
}

/** Run code in the popup, which is where the settings drawer's messages really come from. */
const fromPopup = (fn, ...args) => popup.evaluate(fn, ...args);

try {
  await sleep(2000);
  await openPopup();

  const granted = await inWorker(async (origin) =>
    chrome.permissions.contains({ origins: [origin] }), `${WEB_URL}/*`);
  console.log(`permission for ${WEB_URL}/* : ${granted} (pre-granted, stands in for the Save click)`);

  const before = await inWorker(async () => {
    await chrome.storage.local.remove('token');
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    return { scripts: scripts.map((s) => s.id), token: (await chrome.storage.local.get('token')).token ?? null };
  });
  console.log(`before  : dynamic scripts ${JSON.stringify(before.scripts)}, token ${before.token ?? '(none)'}`);

  // What the settings drawer sends after you save a custom dashboard URL.
  await fromPopup(async (webUrl) => {
    await chrome.storage.local.set({ webUrl });
    await chrome.runtime.sendMessage({ type: 'PERFSCOPE_WEB_URL', webUrl });
  }, WEB_URL);
  await sleep(800);

  const after = await inWorker(async () => {
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    return scripts.map((s) => ({ id: s.id, matches: s.matches }));
  });
  console.log(`after   : ${JSON.stringify(after)}`);

  // Now behave like the dashboard: store the auth payload and load the page.
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((token) => {
    localStorage.setItem('perfscope-auth', JSON.stringify({ state: { token }, version: 0 }));
  }, TOKEN);
  await page.goto(WEB_URL, { waitUntil: 'networkidle0' });
  await sleep(1500);

  const synced = await inWorker(async () => (await chrome.storage.local.get('token')).token ?? null);
  console.log(`\n  token in extension storage: ${synced ?? '(none)'}`);
  console.log(synced === TOKEN
    ? '  PASS — a self-hosted dashboard origin syncs its JWT.'
    : '  FAIL — the token never reached the extension.');

  // Pointing back at the default must clean the dynamic registration up, or a revoked
  // origin keeps a content script running against it forever.
  await fromPopup(async () => {
    await chrome.storage.local.set({ webUrl: 'http://localhost:5173' });
    await chrome.runtime.sendMessage({ type: 'PERFSCOPE_WEB_URL', webUrl: 'http://localhost:5173' });
  });
  await sleep(800);
  const cleaned = await inWorker(async () =>
    (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id));
  console.log(`\n  back on the default origin: dynamic scripts ${JSON.stringify(cleaned)}`);
  console.log(cleaned.length === 0
    ? '  PASS — the dynamic registration is removed, the static one still covers it.'
    : '  FAIL — a stale registration was left behind.');
} finally {
  await browser.close();
  server.close();
  rmSync(DIST, { recursive: true, force: true });
}
