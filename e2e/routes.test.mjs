import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEB_URL,
  waitForServers,
  registerUser,
  launchAuthedBrowser,
  cleanupUser,
} from './helpers.mjs';

// Every route the SPA serves, with a marker that must appear in the rendered body.
// Markers are deliberately loose (most live in the persistent sidebar) so cosmetic
// copy changes don't break the smoke suite.
const ROUTES = [
  { path: '/', marker: /PerfScope/i },
  { path: '/login', marker: /PerfScope/i },
  { path: '/app', marker: /New Audit|Analyze/i },
  { path: '/websites', marker: /Websites/i },
  { path: '/history', marker: /History/i },
  { path: '/compare', marker: /Compare/i },
  { path: '/compare-history', marker: /Compare History/i },
  { path: '/automation', marker: /Automation/i },
  { path: '/extension', marker: /Extension|Companion/i },
  { path: '/settings', marker: /Settings/i },
];

// Errors caused by the backend being briefly unreachable (e.g. tsx watch restart)
// rather than by the frontend itself. One retry is allowed for these only.
const TRANSIENT = /Failed to load resource|net::ERR_|50[24] \(/;

test('all routes render without console or page errors', { timeout: 180_000 }, async (t) => {
  await waitForServers();
  const auth = await registerUser();
  const { browser, page, errors } = await launchAuthedBrowser(auth);

  t.after(async () => {
    await browser.close();
    await cleanupUser(auth.email);
  });

  const visit = async (path) => {
    const before = errors.length;
    await page.goto(WEB_URL + path, { waitUntil: 'networkidle2', timeout: 45_000 });
    await new Promise((r) => setTimeout(r, 1200));
    const body = await page.evaluate(() => document.body.innerText);
    return { body, newErrors: errors.slice(before), before };
  };

  for (const { path, marker } of ROUTES) {
    await t.test(`route ${path}`, async () => {
      let { body, newErrors, before } = await visit(path);

      // Retry once if every error is transient backend-unreachable noise.
      if (newErrors.length > 0 && newErrors.every((e) => TRANSIENT.test(e.text))) {
        errors.length = before;
        await waitForServers();
        ({ body, newErrors } = await visit(path));
      }

      assert.ok(body.trim().length > 0, `body of ${path} is empty`);
      assert.match(body, marker, `body of ${path} lacks expected content`);
      assert.equal(
        newErrors.length,
        0,
        `console/page errors on ${path}:\n${newErrors.map((e) => `  ${e.text}`).join('\n')}`,
      );
    });
  }
});
