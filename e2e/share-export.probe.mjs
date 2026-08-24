/**
 * Taking a result out of the app: the share card, the clipboard, and the printed page.
 *
 * The card is drawn on a canvas, so "a PNG was produced" is a weak claim — a blank
 * 1200×630 rectangle satisfies it. What is asserted here is that the pixels carry the
 * result: the ring for each category is painted the colour of the band that score falls
 * in, which is the one thing a reader takes from the card at a glance and the one thing a
 * wrong `scores` mapping would silently break.
 *
 *   node e2e/share-export.probe.mjs [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  WEB_URL, BACKEND_URL, MONGODB_URI, registerUser, cleanupUser,
  launchAuthedBrowser, waitForServers, sleep,
} from './helpers.mjs';
import { MongoClient } from 'mongodb';

const OUT = process.argv[2] ?? '/tmp/perfscope-share-export';
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/** Chosen so the four rings land in three different bands — good, middling, poor. */
const SCORES = { performance: 42, accessibility: 96, bestPractices: 74, seo: 91 };
const METRICS = { fcp: 1200, lcp: 4100, tbt: 620, cls: 0.02, si: 2200, tti: 5200 };
const HOST = 'sharecard.probe.test';

await waitForServers();
const { token, user, email } = await registerUser();
const userId = String(user.sub ?? user.id);

await fetch(`${BACKEND_URL}/api/websites`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ url: `https://${HOST}`, name: HOST }),
});

const RESULT = {
  id: 'share-probe-1', url: `https://${HOST}/pricing`,
  timestamp: new Date('2026-08-20T09:30:00Z').toISOString(),
  formFactor: 'mobile', scores: SCORES, metrics: METRICS, audits: [],
};

const mongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await mongo.connect();
await mongo.db().collection('histories').insertOne({
  analysisId: RESULT.id, shortId: 'shr1',
  url: RESULT.url, normalizedUrl: `${HOST}/pricing`, routePath: '/pricing',
  userId, scores: SCORES, metrics: METRICS, fullResult: RESULT,
  source: 'manual', createdAt: new Date(RESULT.timestamp), updatedAt: new Date(RESULT.timestamp),
});
await mongo.close();

const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  await page.goto(`${WEB_URL}/dashboard`, { waitUntil: 'networkidle0' });
  await sleep(1200);

  // The renderer is a pure function of the result, so it is exercised directly in the
  // page rather than by driving the UI into the one state that happens to call it.
  const card = await page.evaluate(async (result) => {
    const mod = await import('/src/entities/analysis/shareCard.ts');
    const canvas = mod.drawShareCard(result);
    const ctx = canvas.getContext('2d');
    // Sampled where each ring's arc starts: twelve o'clock on the ring, in device pixels.
    const RINGS = 4, SCALE = 2, W = 1200, RING_Y = 268, R = 58;
    const step = (W - 128) / RINGS;
    const at = (x, y) => {
      const [r, g, b] = ctx.getImageData(Math.round(x * SCALE), Math.round(y * SCALE), 1, 1).data;
      return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    };
    return {
      width: canvas.width, height: canvas.height,
      filename: mod.shareCardFilename(result),
      arcs: Array.from({ length: RINGS }, (_, i) => at(64 + step * i + step / 2, RING_Y - R)),
      background: at(600, 600),
      png: canvas.toDataURL('image/png'),
    };
  }, RESULT);

  writeFileSync(`${OUT}/card.png`, Buffer.from(card.png.split(',')[1], 'base64'));

  check(card.width === 2400 && card.height === 1260,
    `the card is Open Graph sized, drawn at 2× (${card.width}×${card.height})`);
  check(card.filename === `perfscope-${HOST}-2026-08-20.png`,
    `the filename names the site and the day (${card.filename})`);

  // #14c08a good (>=90) · #e6a23c needs-improvement (>=50) · #f2647a poor
  const expected = ['#f2647a', '#14c08a', '#e6a23c', '#14c08a'];
  const got = card.arcs;
  console.log(`  scores ${Object.values(SCORES).join(' ')} → arcs ${got.join(' ')}`);
  check(JSON.stringify(got) === JSON.stringify(expected),
    `each ring is painted the band its score falls in (expected ${expected.join(' ')})`);
  check(card.background !== '#000000', 'and the card is painted, not left transparent');

  // ── The menu ───────────────────────────────────────────────────────────────
  // `/history?open=<id>` is the app's own deep link into the analyzer — the same path the
  // extension uses — so the result arrives in the store exactly as a real reopen would.
  const stored = await (await fetch(`${BACKEND_URL}/api/history/all`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  const entryId = (stored.data?.items ?? stored.data ?? [])[0]?.id;
  console.log(`  reopening stored audit ${entryId}`);

  await page.goto(`${WEB_URL}/history?open=${entryId}`, { waitUntil: 'networkidle0' });
  await sleep(3000);
  check(new URL(page.url()).pathname === '/app',
    `a stored audit reopens in the analyzer (${new URL(page.url()).pathname})`);

  const menu = await page.evaluate(() => {
    // Exactly "Export": the history page's own buttons are "Export JSON" and "Export CSV",
    // and a prefix match finds one of those instead.
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Export');
    btn?.click();
    return !!btn;
  });
  await sleep(400);
  check(menu, 'the result offers an Export menu');

  const items = await page.evaluate(() =>
    [...document.querySelectorAll('[role="menuitem"]')].map(b => b.innerText.split('\n')[0].trim()));
  console.log(`  menu: ${items.join(' | ')}`);
  check(items.length === 4 && items.some(i => /Download image/.test(i)) && items.some(i => /PDF/.test(i)),
    'with the image, the clipboard, the PDF and the raw JSON behind one button');
  await page.screenshot({ path: `${OUT}/export-menu.png` });

  // Clicking outside closes it — a menu that traps the page is worse than no menu.
  await page.mouse.click(20, 400);
  await sleep(300);
  check((await page.evaluate(() => document.querySelectorAll('[role="menuitem"]').length)) === 0,
    'and it closes when you click away');

  // ── Print ──────────────────────────────────────────────────────────────────
  // Emulating print media is what the browser itself does for Ctrl-P, so this is the
  // real question: does the page survive being laid out on paper?
  await page.emulateMediaType('print');
  await sleep(500);
  const printed = await page.evaluate(() => {
    const marked = [...document.querySelectorAll('[data-print="hide"]')];
    const hidden = marked.length >= 4 && marked.every(el => getComputedStyle(el).display === 'none');
    // Counted, not just `every`: a component that drops the attribute leaves an empty set,
    // and `every` on nothing is true — the check would pass while the form still printed.
    const formGone = !/Enter a URL to analyze/.test(document.body.innerText);
    const root = document.querySelector('[data-print="root"]');
    return {
      hidden, formGone,
      scrolls: root ? getComputedStyle(root).overflowY : 'no root',
      theme: document.documentElement.getAttribute('data-theme'),
    };
  });
  check(printed.hidden && printed.formGone,
    'printing drops the shell — sidebar, toolbar, advisor, and the search form');
  check(printed.scrolls === 'visible', `and the scroll container stops scrolling (${printed.scrolls})`);
  // `emulateMediaType` applies the stylesheet but does not fire the print events, and the
  // palette swap hangs off those — so this asserts the listener the browser will call.
  const themed = await page.evaluate(() => {
    const root = document.documentElement;
    window.dispatchEvent(new Event('beforeprint'));
    // Both halves read here, while the print state is still applied: reading them in the
    // return statement samples the restored theme and quietly asserts nothing.
    const during = root.getAttribute('data-theme');
    const dark = root.classList.contains('dark');
    window.dispatchEvent(new Event('afterprint'));
    return { during, dark, after: root.getAttribute('data-theme'), darkAfter: root.classList.contains('dark') };
  });
  check(themed.during === 'light' && !themed.dark,
    `and the palette goes light for the page, so dark-theme text is not printed on white (${themed.during})`);
  check(themed.after === null && themed.darkAfter,
    'the screen goes back to the reader\'s own theme afterwards, both halves of it');

  {
    // Screenshot with the print palette applied — what actually lands on paper.
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await sleep(400);
    await page.screenshot({ path: `${OUT}/print-view.png`, fullPage: false });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  }
  await page.emulateMediaType(null);

  const real = errors.filter(e => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map(e => e.text).join(' | ') || 'none'})`);
  console.log(`  screenshots → ${OUT}`);
} finally {
  await browser.close();
  const cleanup = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await cleanup.connect();
  await cleanup.db().collection('histories').deleteMany({ userId });
  await cleanup.close();
  await cleanupUser(email);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
