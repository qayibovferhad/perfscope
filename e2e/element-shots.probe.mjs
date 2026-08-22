/**
 * A selector tells you which element failed; a picture tells you which element failed.
 *
 * `apps/backend/probes/element-shots.probe.mts` proves the crops are taken, bounded and
 * stored. This proves they arrive in the browser: a thumbnail on the detail row, a
 * lightbox behind it, in both themes, on the page the analyzer actually renders.
 *
 * Audits the same deliberately-broken fixture the filter probe uses, served here on its
 * own port so the two can run at the same time.
 *
 *   node e2e/element-shots.probe.mjs [outDir]
 */
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  WEB_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep, bodyText,
} from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? '/tmp/perfscope-element-shots';
mkdirSync(OUT, { recursive: true });

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

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

// A console error says a resource failed but not which one; the analyzer page pulls from
// the backend, the socket and the audited page's own origin, and they fail differently.
const failedRequests = [];
page.on('requestfailed', (req) => {
  failedRequests.push(`${req.failure()?.errorText ?? '?'} ${req.url().slice(0, 120)}`);
});

try {
  console.log(`auditing ${TARGET} …`);
  await page.goto(`${WEB_URL}/app?url=${encodeURIComponent(TARGET)}&audit=color-contrast`, { waitUntil: 'networkidle0' });

  let ready = false;
  for (let i = 0; i < 240; i++) {
    if (/failing elements/i.test(await bodyText(page))) { ready = true; break; }
    await sleep(500);
  }
  check(ready, 'the audit finished and the deep-linked finding is open with its evidence');
  await sleep(1000);

  // ─── Thumbnails ────────────────────────────────────────────────────────────
  const thumbs = await page.$$eval('img[alt^="Screenshot of"]', (els) =>
    els.map((e) => ({
      src: e.getAttribute('src')?.slice(0, 24) ?? '',
      alt: e.getAttribute('alt') ?? '',
      w: e.naturalWidth,
      h: e.naturalHeight,
      lazy: e.getAttribute('loading') === 'lazy',
    })));
  console.log(`  thumbnails: ${thumbs.length}`);
  for (const t of thumbs.slice(0, 4)) console.log(`    ${t.w}×${t.h}  ${t.alt.slice(0, 60)}`);

  check(thumbs.length > 0, `the failing elements come with pictures (${thumbs.length})`);
  check(thumbs.every((t) => t.src.startsWith('data:image/jpeg')), 'each is an inline JPEG, so nothing is fetched to render it');
  check(thumbs.every((t) => t.w > 0 && t.h > 0), 'each one actually decoded — a broken crop would be 0×0');
  check(thumbs.every((t) => t.w <= 480 && t.h <= 320), 'none exceeds the crop cap');
  check(thumbs.every((t) => /Screenshot of /.test(t.alt)), 'each carries an alt naming the element it shows');
  check(thumbs.every((t) => t.lazy), 'they load lazily — a report can carry two dozen');

  // A crop must be a crop. If every picture were the whole page they would be identical,
  // and identical pictures are worse than none: they look like evidence and are not.
  const distinct = await page.$$eval('img[alt^="Screenshot of"]', (els) =>
    new Set(els.map((e) => e.getAttribute('src'))).size);
  check(distinct > 1 || thumbs.length <= 1, `the pictures differ from one another (${distinct} distinct)`);

  // ─── The lightbox ──────────────────────────────────────────────────────────
  await page.evaluate(() => {
    const img = document.querySelector('img[alt^="Screenshot of"]');
    img?.closest('button')?.scrollIntoView({ block: 'center' });
    img?.closest('button')?.click();
  });
  await sleep(600);
  const modalText = await bodyText(page);
  check(/failing element/i.test(modalText) && /cropped from the page/i.test(modalText),
    'clicking a thumbnail opens the full crop');
  // "Larger than the thumbnail" cannot be a pixel threshold — a crop of a small button is
  // narrower than the 140px thumbnail box to begin with. The honest claim is that the
  // lightbox shows the crop at its own size rather than shrunk into a row.
  const lightbox = await page.$$eval('[data-lightbox] img', (els) =>
    els.map((e) => ({ rendered: Math.round(e.getBoundingClientRect().width), natural: e.naturalWidth })));
  console.log(`  lightbox image: ${lightbox.map((l) => `${l.rendered}px of ${l.natural}px natural`).join(', ') || '(none)'}`);
  check(lightbox.length === 1, 'exactly one crop is on screen in the lightbox');
  check(lightbox.every((l) => l.rendered >= Math.min(l.natural, 300)),
    'shown at full size rather than shrunk into a row');
  await page.screenshot({ path: `${OUT}/lightbox.png` });

  await page.keyboard.press('Escape');
  await sleep(400);
  check(!/cropped from the page/i.test(await bodyText(page)), 'Escape closes it');

  // ─── Both themes ───────────────────────────────────────────────────────────
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => {
      localStorage.setItem('perfscope-theme', t);
      if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
    }, theme);
    await sleep(400);
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('p')]
        .find((n) => /failing elements/i.test(n.textContent ?? ''));
      el?.scrollIntoView({ block: 'center' });
    });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/${theme}-element-shots.png` });
  }
  console.log(`  screenshots → ${OUT}`);

  if (failedRequests.length > 0) console.log(`  failed requests: ${failedRequests.join(' | ')}`);
  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map((e) => e.text).join(' | ') || 'none'})`);
} finally {
  await browser.close();
  await cleanupUser(email);
  fixtureServer.close();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
