import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEB_URL,
  waitForServers,
  registerUser,
  launchAuthedBrowser,
  cleanupUser,
} from './helpers.mjs';

// A full Lighthouse run (two parallel Chrome workers on the backend) takes a
// while, so the whole test gets a generous budget.
test('live analysis of https://example.com streams scores', { timeout: 180_000 }, async (t) => {
  await waitForServers();
  const auth = await registerUser();
  const { browser, page, errors } = await launchAuthedBrowser(auth);

  t.after(async () => {
    await browser.close();
    // The backend persists history asynchronously after analysis:complete —
    // give it a moment to land so cleanup catches the row too.
    await new Promise((r) => setTimeout(r, 3000));
    await cleanupUser(auth.email);
  });

  await page.goto(`${WEB_URL}/app`, { waitUntil: 'networkidle2', timeout: 45_000 });
  await page.waitForSelector('input');
  await page.type('input', 'https://example.com');
  await page.keyboard.press('Enter');

  // Poll the rendered body until streamed category scores show up.
  const deadline = Date.now() + 150_000;
  let body = '';
  let scored = false;
  let failed = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    body = await page.evaluate(() => document.body.innerText);
    if (/analysis failed|something went wrong|cannot find module/i.test(body)) {
      failed = true;
      break;
    }
    // The score cards render category labels even as skeletons, and the progress
    // view shows percentages — so require the labels AND a bare 2-3 digit number
    // that is neither a percentage nor a unit-suffixed metric readout.
    const withoutProgressNumbers = body
      .replace(/\d{1,3}\s*%/g, '')
      .replace(/\b\d+([.,]\d+)?\s*(ms|s|kb|mb)\b/gi, '');
    if (
      /Performance/i.test(body) &&
      /Accessibility/i.test(body) &&
      /\b\d{2,3}\b/.test(withoutProgressNumbers)
    ) {
      scored = true;
      break;
    }
  }

  assert.ok(!failed, `analysis reported failure; body excerpt: ${body.slice(0, 600)}`);
  assert.ok(scored, `no streamed scores within 150s; body excerpt: ${body.slice(0, 600)}`);

  // Uncaught page errors are always a bug; console noise from the long-running
  // socket stream is checked by the routes suite instead.
  const pageErrors = errors.filter((e) => e.text.startsWith('PAGEERROR'));
  assert.equal(
    pageErrors.length,
    0,
    `page errors during analysis:\n${pageErrors.map((e) => `  ${e.text}`).join('\n')}`,
  );
});
