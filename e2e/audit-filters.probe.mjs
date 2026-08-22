/**
 * The audit list is the part of a report a person actually works from, and until now it
 * was one severity-sorted pile of performance, accessibility, SEO and best-practices
 * findings with the evidence — the selectors and filenames Lighthouse blamed — visible
 * only to the AI. This drives the new controls against a real audit.
 *
 * The page under test is served from `e2e/fixtures/inaccessible.html` by this probe
 * itself: it fails on purpose, in four different accessibility groups and in more than one
 * category, which is the only way to assert grouping and category filtering without
 * depending on a third-party site staying broken.
 *
 *   node e2e/audit-filters.probe.mjs [outDir]
 */
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  WEB_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep, bodyText,
} from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? '/tmp/perfscope-audit-filters';
mkdirSync(OUT, { recursive: true });

const PORT = 3397;
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

/** Visible audit rows, by their title. */
const visibleTitles = (page) =>
  page.$$eval('button[aria-expanded]', (els) =>
    els
      .filter((e) => e.querySelector('b'))
      .map((e) => e.querySelector('b').textContent.trim()));

const clickByText = (page, re) =>
  page.evaluate((source) => {
    const rx = new RegExp(source, 'i');
    const btn = [...document.querySelectorAll('button')].find((b) => rx.test(b.textContent ?? ''));
    btn?.scrollIntoView({ block: 'center' });
    btn?.click();
    return Boolean(btn);
  }, re.source);

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  console.log(`auditing the deliberately broken fixture at ${TARGET} …`);
  await page.goto(`${WEB_URL}/app?url=${encodeURIComponent(TARGET)}`, { waitUntil: 'networkidle0' });

  let ready = false;
  for (let i = 0; i < 240; i++) {
    if (/opportunities & diagnostics/i.test(await bodyText(page))) { ready = true; break; }
    await sleep(500);
  }
  check(ready, 'the analysis completed and rendered the audit list');
  await sleep(1200);

  // ─── The category filter ───────────────────────────────────────────────────
  const chips = await page.$$eval('[aria-label="Category filter"] button', (els) =>
    els.map((e) => e.textContent.trim()));
  console.log(`  categories: ${chips.join(' | ')}`);
  check(chips.length >= 3, `the filter offers "All" plus the categories that reported something (${chips.length})`);
  check(chips[0].startsWith('All'), 'the first chip is All');
  check(chips.every((c) => /\d+$/.test(c)), 'every chip carries a count');
  check(chips.some((c) => /^Accessibility/.test(c)), 'accessibility is one of them');

  const allCount = Number(chips[0].match(/(\d+)$/)[1]);
  const before = await visibleTitles(page);
  check(before.length === allCount, `"All ${allCount}" matches the rows on screen (${before.length})`);

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[aria-label="Category filter"] button')]
      .find((b) => /^Accessibility/.test(b.textContent ?? ''));
    btn?.click();
  });
  await sleep(400);
  const a11yOnly = await visibleTitles(page);
  const a11yCount = Number(chips.find((c) => /^Accessibility/.test(c)).match(/(\d+)$/)[1]);
  check(a11yOnly.length === a11yCount, `switching to Accessibility narrows the list to ${a11yCount} (${a11yOnly.length})`);
  check(a11yOnly.length < before.length, 'which is fewer rows than All');

  // ─── Grouped accessibility view ────────────────────────────────────────────
  const groups = await page.$$eval('p', (els) =>
    els.map((e) => e.textContent.trim())
       .filter((t) => /^[A-Z].*· \d+$/.test(t) && !/^ALL/i.test(t)));
  console.log(`  accessibility groups: ${groups.join(' | ') || '(none)'}`);
  check(groups.length >= 2, `the findings sit under their Lighthouse groups (${groups.length} groups)`);

  // ─── Search ────────────────────────────────────────────────────────────────
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[aria-label="Category filter"] button')]
      .find((b) => /^All/.test(b.textContent ?? ''));
    btn?.click();
  });
  await sleep(300);

  const search = await page.$('input[aria-label="Search audits"]');
  check(!!search, 'the search field is on the page');
  await search.click();
  await search.type('contrast');
  await sleep(500);
  const found = await visibleTitles(page);
  console.log(`  "contrast" → ${found.length} row(s): ${found.join(' | ')}`);
  check(found.length > 0 && found.length < before.length, 'typing narrows the list');
  check(found.every((t) => /contrast/i.test(t)), 'and every remaining row is about what was typed');

  // A query that matches nothing must say so, and offer the way back.
  await search.click({ clickCount: 3 });
  await search.type('zzz-definitely-not-an-audit');
  await sleep(400);
  const emptyText = await bodyText(page);
  check(/no audits match/i.test(emptyText), 'a query with no matches says so, quoting the query');
  check(/clear filters/i.test(emptyText), 'and offers to clear the filters');
  await clickByText(page, /clear filters/);
  await sleep(400);
  check((await visibleTitles(page)).length === allCount, 'clearing restores every row');

  // ─── The evidence, finally visible ─────────────────────────────────────────
  // Open the contrast finding: its details carry the selector and the failing snippet,
  // which the backend has collected since the AI work and no one could ever see.
  await search.click({ clickCount: 3 });
  await search.type('contrast');
  await sleep(400);
  const opened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button[aria-expanded]')]
      .find((b) => /contrast/i.test(b.querySelector('b')?.textContent ?? ''));
    btn?.scrollIntoView({ block: 'center' });
    btn?.click();
    return Boolean(btn);
  });
  check(opened, 'the contrast finding opens');
  await sleep(600);
  const body = await bodyText(page);
  check(/failing elements/i.test(body), 'the expanded finding shows its failing elements');
  check(/\.faint|\.also-faint|h1|<p/i.test(body), 'naming the actual selector or snippet from the page');

  const copyButtons = await page.$$eval('button[aria-label="Copy path"]', (els) => els.length);
  check(copyButtons > 0, `each selector comes with a copy button (${copyButtons})`);

  // Lighthouse writes its descriptions in Markdown, and every one ends with a "learn more"
  // link. Rendered as text, that tail is a bare URL in brackets mid-sentence.
  check(!/\]\(https?:\/\//.test(body), 'no raw Markdown link is left in the description');
  const learnMore = await page.$$eval('a[target="_blank"]', (els) =>
    els.filter((e) => /dequeuniversity|developer\.chrome|web\.dev/i.test(e.href)).length);
  check(learnMore > 0, `the description's reference is a real link (${learnMore} found)`);

  // ─── The deep link ─────────────────────────────────────────────────────────
  await page.goto(`${WEB_URL}/app?url=${encodeURIComponent(TARGET)}&audit=color-contrast`, { waitUntil: 'networkidle0' });
  for (let i = 0; i < 240; i++) {
    if (/opportunities & diagnostics/i.test(await bodyText(page))) break;
    await sleep(500);
  }
  await sleep(1500);
  const deepOpen = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button[aria-expanded]')]
      .find((b) => /contrast/i.test(b.querySelector('b')?.textContent ?? ''));
    return btn?.getAttribute('aria-expanded') === 'true';
  });
  check(deepOpen, '?audit=color-contrast opens that finding on arrival');

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
        .find((n) => /opportunities & diagnostics/i.test(n.textContent ?? ''));
      el?.scrollIntoView({ block: 'start' });
    });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/${theme}-audit-filters.png` });
  }
  console.log(`  screenshots → ${OUT}`);

  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map((e) => e.text).join(' | ') || 'none'})`);
} finally {
  await browser.close();
  await cleanupUser(email);
  fixtureServer.close();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
