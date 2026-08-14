/**
 * Probe: does the built popup actually load, and does its footer show the manifest's
 * version rather than a literal that can drift from it?
 *
 * Loads the built extension into Chrome and opens popup.html directly. Needs a build
 * first:  pnpm --filter @perfscope/chrome-extension build
 */
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

const DIST = new URL('../apps/chrome-extension/.output/chrome-mv3/', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(`${DIST}manifest.json`, 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../apps/chrome-extension/package.json', import.meta.url).pathname, 'utf8'));

console.log(`package.json ${pkg.version} · manifest ${manifest.version} · agree: ${pkg.version === manifest.version}`);

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage',
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
  ],
});

try {
  // Give the service worker a moment to register so the extension id resolves.
  await new Promise((r) => setTimeout(r, 1500));
  const target = browser.targets().find((t) => t.url().startsWith('chrome-extension://'));
  if (!target) throw new Error('the extension did not register a target — is it built?');
  const id = new URL(target.url()).host;

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

  await page.goto(`chrome-extension://${id}/popup.html`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));

  const text = await page.evaluate(() => document.body.innerText);
  const footer = (text.match(/PerfScope Companion · v[\d.]+/) ?? ['(no footer)'])[0];
  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map((b) => b.textContent?.trim()).filter(Boolean).slice(0, 8));

  console.log(`footer            : ${footer}`);
  console.log(`footer matches manifest: ${footer.endsWith(`v${manifest.version}`)}`);
  console.log(`buttons           : ${buttons.join(' | ')}`);
  console.log(`errors            : ${errors.length ? errors.join(' | ') : 'none'}`);
  process.exitCode = footer.endsWith(`v${manifest.version}`) && errors.length === 0 ? 0 : 1;
} finally {
  await browser.close();
}
