/**
 * Captures the dashboard's pages as PNGs so they can be looked at rather than guessed about.
 *
 * Seeds a little data first — an empty account makes every page look like an empty state,
 * which is not what the pages are being judged on here.
 *
 *   node e2e/screenshot.probe.mjs [outDir]
 */
import { mkdirSync } from 'node:fs';
import { BACKEND_URL, WEB_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep } from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-shots';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['dashboard',       '/dashboard'],
  ['websites',        '/websites'],
  ['history',         '/history'],
  ['compare',         '/compare'],
  ['compare-history', '/compare-history'],
  ['automation',      '/automation'],
  ['scheduled',       '/scheduled'],
  ['extension',       '/extension'],
  ['settings',        '/settings'],
  ['analyzer',        '/app'],
];

await waitForServers();
const { token, user, email } = await registerUser();

const api = (path, opts = {}) => fetch(`${BACKEND_URL}/api${path}`, {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...opts,
});

for (const [url, name] of [['https://example.com', 'Example'], ['https://www.bbc.com', 'BBC News']]) {
  await api('/websites', { method: 'POST', body: JSON.stringify({ url, name }) });
}

const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  for (const [name, path] of PAGES) {
    await page.goto(`${WEB_URL}${path}`, { waitUntil: 'networkidle0' });
    await sleep(2200);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    const h = await page.evaluate(() => document.body.scrollHeight);
    console.log(`  ${name.padEnd(16)} ${String(h).padStart(5)}px`);
  }
  console.log(`\nwritten to ${OUT}`);
  console.log(`console errors: ${errors.length ? errors.map((e) => e.text).slice(0, 3).join(' | ') : 'none'}`);
} finally {
  await browser.close();
  await cleanupUser(email);
}
