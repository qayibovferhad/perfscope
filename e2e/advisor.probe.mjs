/**
 * Probe: does the advisor actually advise?
 *
 * The panel is on every page, so it has three ways to be wrong that a build would not
 * catch: it says nothing, it says something generic, or it costs the page its width.
 *
 * This seeds an account, reads the advice the API produces, and then checks the panel in
 * the browser at two widths — one where it should be part of the layout and one where it
 * must not be.
 *
 *   node e2e/advisor.probe.mjs
 */
import { WEB_URL, BACKEND_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep } from './helpers.mjs';

await waitForServers();
const { token, user, email } = await registerUser();

for (const [url, name] of [['https://example.com', 'Example'], ['https://www.bbc.com', 'BBC News']]) {
  await fetch(`${BACKEND_URL}/api/websites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, name }),
  });
}

// ─── The API ─────────────────────────────────────────────────────────────────
const res = await fetch(`${BACKEND_URL}/api/advice?scope=overview`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { data: advice } = await res.json();

console.log(`GET /api/advice → HTTP ${res.status}`);
if (!advice) {
  console.log('  null — no GEMINI_API_KEY, or the model had nothing to say.');
  console.log('  (that is a valid answer; the UI checks below will show the panel absent)');
} else {
  console.log(`  headline: ${advice.headline}`);
  advice.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.title} — ${s.detail}`));
  // The whole point is advice about *this* account, not web performance in general.
  const mentionsASite = JSON.stringify(advice).match(/example\.com|bbc\.com/i);
  console.log(`  names one of the seeded sites: ${mentionsASite ? 'yes' : 'NO — advice may be generic'}`);
}

// ─── The panel ───────────────────────────────────────────────────────────────
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  for (const [width, expected] of [[1920, 'inline'], [1280, 'rail']]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(`${WEB_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await sleep(3000);

    const seen = await page.evaluate(() => {
      const aside = document.querySelector('aside[aria-label="Advisor"]');
      const rail  = document.querySelector('button[aria-label="Show advisor"]');
      const main  = document.querySelector('main');
      return {
        mode: aside ? (getComputedStyle(aside).position === 'fixed' ? 'overlay' : 'inline') : (rail ? 'rail' : 'none'),
        content: main?.firstElementChild ? Math.round(main.firstElementChild.getBoundingClientRect().width) : 0,
        // The dashboard's own copy of the advice, above the totals strip.
        card: /✦|Advisor/.test(document.body.innerText) || !!document.querySelector('section'),
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    const ok = seen.mode === expected && !seen.overflowX;
    console.log(`\n${width}px  panel ${seen.mode} (expected ${expected}), content ${seen.content}px  ${ok ? '✓' : '✗'}`);
    if (seen.overflowX) console.log('  ← the page scrolls sideways, which it must never do');
  }

  console.log(`\nconsole errors: ${errors.length ? errors.map((e) => e.text).slice(0, 3).join(' | ') : 'none'}`);
} finally {
  await browser.close();
  await cleanupUser(email);
}
