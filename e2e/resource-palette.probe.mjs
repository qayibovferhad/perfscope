/**
 * Probe: do the waterfall's resource badges render the colours RESOURCE_TYPES declares?
 *
 * The palette used to be written out per component — raw colours in one, Tailwind classes
 * in another, a third alpha in a third — so this reads the rendered pixels rather than
 * trusting that the tables agreed. Needs both dev servers.
 */
import { WEB_URL, waitForServers, registerUser, launchAuthedBrowser, cleanupUser, sleep } from './helpers.mjs';

const TARGET = process.env.PROBE_URL ?? 'https://example.com';

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page } = await launchAuthedBrowser({ user, token });

try {
  await page.goto(`${WEB_URL}/app`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /analyze|new audit/i.test(document.body.innerText), { timeout: 20_000 });

  const input = await page.waitForSelector('input[type="text"], input[type="url"]', { timeout: 10_000 });
  await input.type(TARGET);
  await page.keyboard.press('Enter');

  // "RESOURCE" is a column header the empty state draws too, so wait for a real row:
  // the placeholder gone and at least one type badge painted.
  await page.waitForFunction(
    () => document.querySelector('.wf-sk-shim') === null
      && [...document.querySelectorAll('span')]
        .some((e) => ['JS', 'CSS', 'IMG', 'FONT', 'DOC', 'MEDIA', 'XHR'].includes(e.textContent?.trim() ?? '')),
    { timeout: 240_000 },
  );
  await sleep(800);

  const diag = await page.evaluate(() => ({
    hasResourceHeading: /resource/i.test(document.body.innerText),
    spanCount: document.querySelectorAll('span').length,
    shortSpans: [...new Set([...document.querySelectorAll('span')]
      .map((e) => e.textContent?.trim()).filter((t) => t && t.length <= 6))].slice(0, 40),
  }));
  console.log('diagnostics:', JSON.stringify(diag, null, 1).slice(0, 900), '\n');

  const badges = await page.evaluate(() => {
    const labels = new Set(['JS', 'CSS', 'IMG', 'FONT', 'DOC', 'MEDIA', 'XHR']);
    const out = {};
    for (const el of document.querySelectorAll('span')) {
      const t = el.textContent?.trim();
      if (!labels.has(t) || out[t]) continue;
      const s = getComputedStyle(el);
      out[t] = { color: s.color, background: s.backgroundColor, border: s.borderColor };
    }
    return out;
  });

  console.log('rendered badge colours:');
  for (const [label, c] of Object.entries(badges)) {
    console.log(`  ${label.padEnd(6)} text ${c.color.padEnd(22)} fill ${c.background.padEnd(26)} border ${c.border}`);
  }

  const found = Object.keys(badges);
  console.log(`\n${found.length} resource type(s) on screen: ${found.join(', ')}`);
  console.log(found.every((l) => badges[l].color !== 'rgba(0, 0, 0, 0)')
    ? 'every badge painted a colour (none fell through to a missing class)'
    : 'A BADGE RENDERED TRANSPARENT — a palette entry is missing');
} finally {
  await browser.close();
  await cleanupUser(email);
}
