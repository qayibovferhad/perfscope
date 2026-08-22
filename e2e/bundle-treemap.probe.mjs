/**
 * "Reduce unused JavaScript — 612 KB" is a number. The treemap is the answer to *which*
 * JavaScript, and where a source map exists, which package inside it.
 *
 * The page under test is the dashboard's own dev server: it is one of the few pages that
 * reliably serves source maps, so the drill-down has something to drill into. That means
 * this probe audits PerfScope with PerfScope, which is also how the self-audit probe works.
 *
 *   node e2e/bundle-treemap.probe.mjs [outDir]
 */
import { mkdirSync } from 'node:fs';
import {
  WEB_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep, bodyText,
} from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-bundle-treemap';
mkdirSync(OUT, { recursive: true });

const TARGET = WEB_URL;

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/** Tile labels currently drawn on the map, in layout order. */
const tileLabels = (page) =>
  page.$$eval('svg[aria-label^="Treemap"] g text:first-of-type', (els) =>
    els.map((e) => e.textContent.trim()).filter(Boolean));

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  console.log(`auditing ${TARGET} (source maps, so the map has an inside) …`);
  await page.goto(`${WEB_URL}/app?url=${encodeURIComponent(TARGET)}`, { waitUntil: 'networkidle0' });

  let ready = false;
  for (let i = 0; i < 300; i++) {
    if (/never executed/i.test(await bodyText(page))) { ready = true; break; }
    await sleep(500);
  }
  check(ready, 'the audit finished and the JavaScript panel rendered');
  await sleep(1200);

  // ─── The map ───────────────────────────────────────────────────────────────
  const header = await page.$$eval('*', (els) =>
    els.map((e) => e.textContent?.trim() ?? '')
       .find((t) => /^\d+ scripts · .* parsed · \d+% never executed$/.test(t)) ?? '');
  console.log(`  header: ${header}`);
  check(/\d+ scripts/.test(header), 'the header counts the scripts');
  check(/parsed/.test(header) && /% never executed/.test(header), 'and states the total size and the unused share');

  // Direct children of the tile groups only: `defs` holds the hatch pattern and one clip
  // rectangle per labelled tile, and counting those would double the tally.
  const rects = await page.$$eval('svg[aria-label^="Treemap"] > g > rect', (els) =>
    els.map((e) => ({
      w: Number(e.getAttribute('width')),
      h: Number(e.getAttribute('height')),
      fill: e.getAttribute('fill') ?? '',
    })));
  const tiles = rects.filter((r) => !r.fill.startsWith('url('));
  const hatched = rects.filter((r) => r.fill.startsWith('url('));
  console.log(`  ${tiles.length} tiles, ${hatched.length} with an unused overlay`);
  check(tiles.length >= 3, `the map is drawn to scale with a tile per script (${tiles.length})`);
  check(hatched.length > 0, `the unused share is drawn inside the tiles (${hatched.length})`);
  check(tiles.every((r) => r.w > 0 && r.h > 0), 'no tile is zero-sized');

  // Areas must be proportional, which is the entire claim a treemap makes. The biggest
  // tile has to be meaningfully bigger than the median one on any real page.
  const areas = tiles.map((r) => r.w * r.h).sort((a, b) => b - a);
  check(areas[0] > areas[Math.floor(areas.length / 2)], 'tiles differ in area — the map is weighted, not a grid');

  const labels = await tileLabels(page);
  console.log(`  labelled tiles: ${labels.slice(0, 5).join(', ')}${labels.length > 5 ? ' …' : ''}`);
  check(labels.length > 0, 'the larger tiles carry their name');

  // ─── Drill-down ────────────────────────────────────────────────────────────
  const opened = await page.evaluate(() => {
    // The first tile that says it can be opened is the heaviest script with a source map.
    const groups = [...document.querySelectorAll('svg[aria-label^="Treemap"] g')];
    const target = groups.find((g) => g.classList.contains('cursor-pointer'));
    if (!target) return null;
    const name = target.querySelector('text')?.textContent?.trim() ?? '';
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return name;
  });
  console.log(`  opened: ${opened ?? '(nothing openable)'}`);
  check(!!opened, 'at least one script has a module tree to open');
  await sleep(500);

  const crumbs = await page.$$eval('button', (els) =>
    els.map((e) => e.textContent.trim()).filter((t) => t === 'All scripts' || t.length < 60));
  check(crumbs.includes('All scripts'), 'the breadcrumb offers the way back out');

  const inner = await tileLabels(page);
  console.log(`  modules inside: ${inner.slice(0, 5).join(', ')}${inner.length > 5 ? ' …' : ''}`);
  check(inner.length > 0, 'the module level draws its own tiles');
  check(inner.join('|') !== labels.join('|'), 'and they are different tiles from the script level');

  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'All scripts')?.click();
  });
  await sleep(400);
  check((await tileLabels(page)).join('|') === labels.join('|'), 'clicking the breadcrumb returns to the scripts');

  // ─── The readout ───────────────────────────────────────────────────────────
  await page.evaluate(() => {
    const g = document.querySelector('svg[aria-label^="Treemap"] g');
    g?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  });
  await sleep(300);
  const readout = await bodyText(page);
  check(/parsed/.test(readout) && /(over the wire|never executed|click to open)/.test(readout),
    'hovering a tile names it and states its sizes');

  // ─── Both themes ───────────────────────────────────────────────────────────
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => {
      localStorage.setItem('perfscope-theme', t);
      if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
    }, theme);
    await sleep(400);
    await page.evaluate(() => {
      document.querySelector('svg[aria-label^="Treemap"]')?.scrollIntoView({ block: 'center' });
    });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/${theme}-bundle-treemap.png` });
  }
  console.log(`  screenshots → ${OUT}`);

  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map((e) => e.text).join(' | ') || 'none'})`);
} finally {
  await browser.close();
  await cleanupUser(email);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
