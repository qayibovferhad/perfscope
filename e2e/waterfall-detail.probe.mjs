/**
 * Probe: does clicking a waterfall row still open the request detail popover, with every
 * stat in it?
 *
 * Both waterfalls used to carry their own ~75-line copy of that panel. They now share one,
 * so this checks the surface a user actually touches rather than that the file compiles.
 * Needs both dev servers.
 */
import { WEB_URL, waitForServers, registerUser, launchAuthedBrowser, cleanupUser } from './helpers.mjs';

const TARGET = process.env.PROBE_URL ?? 'https://www.wikipedia.org';
const STATS = ['Start', 'End', 'Duration', 'TTFB', 'Download', 'Transfer', 'Resource', 'MIME', 'Status', '3rd-party'];

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page } = await launchAuthedBrowser({ user, token });

try {
  await page.goto(`${WEB_URL}/app`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /analyze|new audit/i.test(document.body.innerText), { timeout: 20_000 });

  const input = await page.waitForSelector('input[type="text"], input[type="url"]', { timeout: 10_000 });
  await input.type(TARGET);
  await page.keyboard.press('Enter');

  await page.waitForFunction(
    () => document.querySelector('.wf-sk-shim') === null
      && [...document.querySelectorAll('span')]
        .some((e) => ['JS', 'CSS', 'IMG', 'FONT', 'DOC', 'MEDIA', 'XHR'].includes(e.textContent?.trim() ?? '')),
    { timeout: 240_000 },
  );
  await new Promise((r) => setTimeout(r, 800));

  // Click the row that owns the first type badge.
  const clicked = await page.evaluate(() => {
    const labels = ['JS', 'CSS', 'IMG', 'FONT', 'DOC', 'MEDIA', 'XHR'];
    const badge = [...document.querySelectorAll('span')]
      .find((e) => labels.includes(e.textContent?.trim() ?? ''));
    if (!badge) return false;
    const row = badge.closest('[class*="cursor-pointer"]') ?? badge.parentElement?.parentElement;
    row?.scrollIntoView({ block: 'center' });
    row?.click();
    return true;
  });
  if (!clicked) throw new Error('no resource row to click');

  await new Promise((r) => setTimeout(r, 600));

  const panel = await page.evaluate((stats) => {
    const text = document.body.innerText;
    return {
      present: stats.filter((s) => text.includes(s)),
      missing: stats.filter((s) => !text.includes(s)),
    };
  }, STATS);

  console.log('detail panel stats present:', panel.present.join(', ') || '(none)');
  if (panel.missing.length) console.log('MISSING:', panel.missing.join(', '));
  console.log(panel.missing.length === 0
    ? '\nthe shared detail panel renders every stat'
    : '\nSTATS MISSING — the shared panel lost something');
  process.exitCode = panel.missing.length === 0 ? 0 : 1;
} finally {
  await browser.close();
  await cleanupUser(email);
}
