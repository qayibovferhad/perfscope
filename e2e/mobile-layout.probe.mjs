/**
 * The dashboard on a phone.
 *
 * Nothing here was *broken* in the sense of overflowing — the shell has had a drawer and a
 * mobile topbar for a long time, and the document never scrolled sideways. What it was is
 * unusable in specific, checkable ways: the Analyze button pushed past the edge of its own
 * card, a 320px resource-name column leaving seventy pixels of a 390px screen for the bars
 * that are the entire point of a waterfall, four full-width stat cards where two-up would
 * do, panel headers shredding a three-word title into three columns, and — after the bell
 * shipped — a notification badge that could not be seen without opening a drawer.
 *
 * So the assertions are about *proportion and reachability*, not just overflow. Run against
 * a real audit, because every one of those problems needs data to appear.
 *
 *   node e2e/mobile-layout.probe.mjs [outDir]
 */
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  WEB_URL, BACKEND_URL, registerUser, cleanupUser, launchAuthedBrowser,
  waitForServers, sleep, bodyText,
} from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? '/tmp/perfscope-mobile';
mkdirSync(OUT, { recursive: true });

const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const PORT = 3393;

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
 * Anything sticking out past the right edge that is not inside something built to scroll
 * sideways. A waterfall lane and a code block are *meant* to scroll; a button is not.
 */
const bleeding = (page) => page.evaluate(() => {
  const win = window.innerWidth;
  return [...document.querySelectorAll('body *')]
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ e, r }) => {
      if (r.width < 2 || r.right <= win + 1) return false;
      for (let p = e.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return false;
      }
      return true;
    })
    .slice(0, 8)
    .map(({ e, r }) => `${e.tagName.toLowerCase()}.${String(e.className).trim().split(/\s+/).slice(0, 2).join('.')} → ${Math.round(r.right)}px`);
});

/**
 * The first visit to a lazily-loaded route makes Vite discover a dependency it has not
 * optimised yet, and it answers by reloading the whole page — which detaches the frame
 * under whatever is measuring it. A dev-server artefact, not the app: measure again once
 * it has settled rather than reporting the reload as a layout failure.
 */
const settle = async (page, fn) => {
  try { return await fn(); }
  catch (err) {
    if (!/detached Frame|Execution context was destroyed/i.test(String(err))) throw err;
    await sleep(1500);
    return fn();
  }
};

await waitForServers();
const { token, user, email } = await registerUser();
await fetch(`${BACKEND_URL}/api/websites`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ url: TARGET.replace(/\/$/, ''), name: 'mobile probe' }),
});

const { browser, page, errors } = await launchAuthedBrowser({ user, token });
await page.setViewport(PHONE);

try {
  // ─── The shell ─────────────────────────────────────────────────────────────
  await page.goto(`${WEB_URL}/dashboard`, { waitUntil: 'networkidle0' });
  await sleep(1500);

  const topbar = await page.evaluate(() => {
    const menu = document.querySelector('button[aria-label="Open menu"]');
    const bell = document.querySelector('button[aria-label^="Notifications"]');
    const inTopbar = (el) => (el?.getBoundingClientRect().top ?? 999) < 80;
    return { menu: inTopbar(menu), bell: inTopbar(bell) };
  });
  check(topbar.menu, 'the menu button is in the topbar');
  check(topbar.bell, 'and so is the bell — a badge behind a drawer is a badge nobody sees');

  await page.click('button[aria-label="Open menu"]');
  await sleep(600);
  check(/my websites/i.test(await bodyText(page)), 'the drawer opens the navigation');
  await page.click('button[aria-label="Close sidebar"]');
  await sleep(500);

  const totals = await page.$$eval('main .grid > div', (els) => {
    const tops = els.slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().top));
    return { rows: new Set(tops).size, count: tops.length };
  }).catch(() => ({ rows: 0, count: 0 }));
  check(totals.count >= 4 && totals.rows === 2, `the four stat cards sit two-up, not stacked (${totals.rows} rows)`);
  check((await bleeding(page)).length === 0, 'nothing on the dashboard bleeds past the edge');
  await page.screenshot({ path: `${OUT}/dashboard.png` });

  // ─── The analyzer form ─────────────────────────────────────────────────────
  await page.goto(`${WEB_URL}/app`, { waitUntil: 'networkidle0' });
  await sleep(1200);

  const form = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button[type="submit"]')].at(-1);
    const input = document.querySelector('input[placeholder^="https"]');
    const card = btn?.closest('[class*="rounded"]');
    if (!btn || !input || !card) return null;
    const b = btn.getBoundingClientRect(), i = input.getBoundingClientRect(), c = card.getBoundingClientRect();
    const field = input.closest('div[class*="border"]')?.getBoundingClientRect() ?? i;
    return {
      buttonInsideCard: b.right <= c.right + 1,
      stacked: b.top >= i.bottom - 2,
      buttonWidth: Math.round(b.width), inputWidth: Math.round(i.width),
      fieldWidth: Math.round(field.width), cardWidth: Math.round(c.width),
    };
  });
  console.log(`  form: field ${form?.fieldWidth}px (input ${form?.inputWidth}px), button ${form?.buttonWidth}px, card ${form?.cardWidth}px`);
  check(form?.buttonInsideCard === true, 'the Analyze button is inside its own card');
  check(form?.stacked === true, 'it sits under the URL field rather than fighting it for width');
  // The wrapper, not the bare <input>: the field sits inside a bordered box with a globe
  // icon, so the input element itself is always narrower than the control.
  check((form?.fieldWidth ?? 0) >= (form?.cardWidth ?? 0) - 2,
    `and the URL field spans the card (${form?.fieldWidth}px of ${form?.cardWidth}px)`);

  const toggles = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('[role="radiogroup"]')];
    return groups.map((g) => {
      const r = g.getBoundingClientRect();
      const last = g.querySelector('button:last-child')?.getBoundingClientRect();
      return { right: Math.round(r.right), lastVisible: !!last && last.right <= r.right + 1 };
    });
  });
  check(toggles.every((t) => t.right <= 390), 'the device and precision toggles stay on screen');
  check(toggles.every((t) => t.lastVisible), 'with their last option not clipped');
  await page.screenshot({ path: `${OUT}/analyzer-form.png` });

  // ─── A real report ─────────────────────────────────────────────────────────
  await page.goto(`${WEB_URL}/app?url=${encodeURIComponent(TARGET)}`, { waitUntil: 'networkidle0' });
  for (let i = 0; i < 300; i++) {
    if (/opportunities & diagnostics/i.test(await bodyText(page))) break;
    await sleep(500);
  }
  await sleep(2500);

  const bleeds = await bleeding(page);
  check(bleeds.length === 0, `nothing in the report bleeds past the edge (${bleeds.join(', ') || 'clean'})`);

  const waterfall = await page.evaluate(() => {
    const label = [...document.querySelectorAll('span')].find((s) => s.textContent?.trim() === 'Resource');
    const col = label?.parentElement;
    const panel = col?.closest('[class*="rounded"]');
    if (!col || !panel) return null;
    const rows = [...document.querySelectorAll('[title^="http"]')]
      .map((e) => ({ text: e.textContent?.trim() ?? '', w: Math.round(e.getBoundingClientRect().width) }))
      .filter((r) => r.text);
    return {
      colWidth: Math.round(col.getBoundingClientRect().width),
      panelWidth: Math.round(panel.getBoundingClientRect().width),
      named: rows.filter((r) => r.w > 40).length,
      sample: rows.slice(0, 3).map((r) => `${r.text} (${r.w}px)`),
    };
  });
  console.log(`  waterfall: name column ${waterfall?.colWidth}px of ${waterfall?.panelWidth}px · ${waterfall?.sample.join(', ')}`);
  check((waterfall?.colWidth ?? 999) < (waterfall?.panelWidth ?? 1) * 0.45,
    'the name column leaves most of the panel to the bars, which are the point of a waterfall');
  check((waterfall?.named ?? 0) >= 2, `and the filenames are still legible (${waterfall?.named} rows)`);

  // A header that wraps is fine; one that shreds a title into a narrow column is not.
  const headers = await page.evaluate(() => {
    // `h2` as well as `span`: panel titles became real headings during the accessibility
    // pass, and a selector that only knew about spans would have kept passing over an
    // empty list — the count below is printed so that shows up as zero rather than green.
    const titles = [...document.querySelectorAll('span, h2')]
      .filter((s) => String(s.className).includes('font-bold') && s.textContent && s.textContent.length > 12);
    return titles.map((t) => {
      const r = t.getBoundingClientRect();
      const lines = Math.round(r.height / 20);
      return { text: t.textContent.trim().slice(0, 34), lines, width: Math.round(r.width) };
    });
  });
  const shredded = headers.filter((h) => h.lines >= 3);
  console.log(`  panel titles: ${headers.length} checked, widest ${Math.max(0, ...headers.map(h => h.width))}px`);
  check(shredded.length === 0, `no panel title is broken over three lines (${shredded.map(h => h.text).join(', ') || 'none'})`);

  for (const [i, frac] of [0, 0.25, 0.5, 0.75].entries()) {
    await page.evaluate((f) => {
      const m = document.querySelector('main');
      m?.scrollTo(0, (m.scrollHeight - m.clientHeight) * f);
    }, frac);
    await sleep(500);
    await page.screenshot({ path: `${OUT}/report-${i}.png` });
  }

  // ─── Every other route ─────────────────────────────────────────────────────
  for (const route of ['/websites', '/history', '/compare', '/flows', '/team', '/automation', '/settings', '/scheduled']) {
    await page.goto(`${WEB_URL}${route}`, { waitUntil: 'networkidle0' });
    await sleep(1200);
    const bad = await settle(page, () => bleeding(page));
    check(bad.length === 0, `${route} fits the screen (${bad.join(', ') || 'clean'})`);
  }

  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map((e) => `${e.route} :: ${e.text}`).join(' | ') || 'none'})`);
  console.log(`  screenshots → ${OUT}`);
} finally {
  await browser.close();
  await cleanupUser(email);
  fixtureServer.close();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
