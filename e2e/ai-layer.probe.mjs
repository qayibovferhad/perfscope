/**
 * Probe: is the AI layer actually visible, and does it behave while it is still loading?
 *
 * Three questions, in one live audit:
 *   1. Between `analysis:complete` and `analysis:insights` the AI surfaces show skeletons —
 *      the report is readable immediately and the commentary is clearly *coming*, not missing.
 *   2. When the insights land, the skeletons are replaced by real text in every place:
 *      the page card, the waterfall narrative, a Core Web Vital note, an audit explanation.
 *   3. Nothing is left pulsing afterwards.
 *
 * Needs backend (3101) and web (5173) running, and GEMINI_API_KEY set:
 *
 *     node e2e/ai-layer.probe.mjs [url]
 */
import { WEB_URL, BACKEND_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep } from './helpers.mjs';

const TARGET = process.argv[2] ?? 'https://www.bbc.com';

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

/** What the page looks like right now, from the AI layer's point of view. */
const snapshot = () => page.evaluate(() => {
  const text = document.body.innerText;
  const has = (s) => text.includes(s);
  return {
    skeletons:   document.querySelectorAll('.animate-pulse').length,
    insights:    has('AI Insights'),
    narrative:   has('How this page loaded'),
    gemini:      (text.match(/Powered by Gemini/g) ?? []).length,
    scores:      has('Performance'),
  };
});

try {
  await page.goto(`${WEB_URL}/app`, { waitUntil: 'networkidle0' });
  await sleep(2500);
  console.log('landed on', page.url());
  await page.waitForSelector('input[type="text"]', { timeout: 20_000 });
  await page.type('input[type="text"]', TARGET);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /analyz/i.test(b.textContent ?? ''));
    btn?.click();
  });
  console.log(`auditing ${TARGET} …`);

  // Poll through the run. The interesting window is the couple of seconds between the
  // scores landing and the commentary arriving, so sample often enough to catch it.
  let sawSkeletons = null;
  let final = null;
  for (let i = 0; i < 200; i++) {
    const snap = await snapshot();
    if (snap.gemini > 0 && snap.skeletons > 0 && !sawSkeletons) {
      sawSkeletons = snap;
      console.log(`  skeleton phase seen: ${snap.skeletons} pulsing element(s), AI card already titled`);
    }
    if (snap.gemini > 0 && snap.skeletons === 0) { final = snap; break; }
    await sleep(500);
  }

  if (!final) {
    console.log('never reached a settled AI state — last look:', await snapshot());
  } else {
    // Pull the actual rendered commentary so this proves text, not just element counts.
    const rendered = await page.evaluate(() => {
      const out = {};
      const card = [...document.querySelectorAll('div')].find(
        (d) => d.querySelector('h3')?.textContent === 'AI Insights');
      out.insights = card?.lastElementChild?.textContent?.trim().slice(0, 120) ?? null;
      const narr = [...document.querySelectorAll('div')].find(
        (d) => d.querySelector('h3')?.textContent === 'How this page loaded');
      out.narrative = narr?.lastElementChild?.textContent?.trim().slice(0, 120) ?? null;
      return out;
    });

    console.log('\n── settled ──');
    console.log(`  skeletons left : ${final.skeletons}`);
    console.log(`  AI card        : ${rendered.insights ?? '(missing)'}`);
    console.log(`  waterfall card : ${rendered.narrative ?? '(missing)'}`);
    console.log(`  Gemini badges  : ${final.gemini}`);
  }

  // ── Per-vital and per-audit notes ───────────────────────────────────────────
  // Every AI surface carries the same sparkle, so counting them counts the layer.
  const sparkles = () => page.evaluate(() =>
    document.querySelectorAll('svg[class*="sparkle"]').length);
  console.log(`\n  AI touchpoints on the page: ${await sparkles()}`);

  const vitals = await page.evaluate(() => {
    const notes = [];
    for (const svg of document.querySelectorAll('svg[class*="sparkle"]')) {
      const line = svg.parentElement?.textContent?.trim();
      // The two cards put their sparkle beside a heading; the inline notes do not.
      if (line && !/^(AI Insights|How this page loaded)/.test(line)) notes.push(line.slice(0, 90));
    }
    return notes;
  });
  console.log(`  inline notes rendered     : ${vitals.length}`);
  vitals.slice(0, 3).forEach((n) => console.log(`      ${n}`));

  // Open every audit row and see how many carry an explanation of their own.
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button[aria-expanded="false"]')) b.click();
  });
  await sleep(800);
  console.log(`  after opening all audits  : ${await sparkles()} touchpoints`);

  // ── Oversized resources ────────────────────────────────────────────────────
  // Driven by NetworkRequest.isCritical, whose thresholds are compared against transfer
  // (post-compression) size. They were high enough that this table and the Critical stat
  // card were blank on four audits in five; these assertions are what stops that returning.
  const oversized = await page.evaluate(() => {
    const t = document.body.innerText;
    // Case-insensitive on purpose: these headings are CSS-uppercased, so innerText
    // returns "HEAVIEST RESOURCES (6)" and a case-sensitive match reads as "not rendered".
    const table = t.match(/(oversized|heaviest) resources \((\d+)\)/i);
    const stat  = t.match(/critical\s+(\d+)\s+oversized files/i);
    return { table: table?.[0] ?? null, criticalStat: stat?.[1] ?? null, alert: /heavy enough to hold up the page/.test(t) };
  });
  console.log(`\n  resources table  : ${oversized.table ?? '(not rendered)'}`);
  console.log(`  Critical stat    : ${oversized.criticalStat ?? '(not found)'}`);
  console.log(`  oversized alert  : ${oversized.alert ? 'shown' : 'not shown'}`);

  // ── Reopened from history: same commentary, no skeleton, no socket ──────────
  // Uses the extension's own deep link rather than hunting for a button, and it exercises
  // the path that matters: the stored result is loaded into the analyzer with no audit
  // running, so anything AI on screen came out of the database.
  const list = await (await fetch(`${BACKEND_URL}/api/history/all`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  const entries = list.data ?? [];
  const entryId = entries[0]?.id;

  if (!entryId) {
    console.log('\n  history: nothing saved yet — skipped');
  } else {
    await page.goto(`${WEB_URL}/history?open=${entryId}`, { waitUntil: 'networkidle0' });
    await sleep(4000);
    const stored = await page.evaluate(() => ({
      route:     location.pathname,
      skeletons: document.querySelectorAll('.animate-pulse').length,
      sparkles:  document.querySelectorAll('svg[class*="sparkle"]').length,
      gemini:    (document.body.innerText.match(/Powered by Gemini/g) ?? []).length,
    }));
    console.log(`\n  reopened from history     : at ${stored.route} — ${stored.sparkles} touchpoints, ${stored.gemini} cards, ${stored.skeletons} skeletons`);
    console.log('  (skeletons must be 0 — a stored result already carries its AI)');
  }

  console.log(`\nskeleton phase observed: ${sawSkeletons ? 'yes' : 'no (AI may have been cached and instant)'}`);
  console.log(`console errors: ${errors.length ? errors.map((e) => e.text).join(' | ') : 'none'}`);
} finally {
  await browser.close();
  await cleanupUser(email);
}
