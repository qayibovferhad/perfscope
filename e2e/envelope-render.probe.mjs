/**
 * Probe: does data still reach the screen now that every endpoint is enveloped?
 *
 * The route smoke test asserts that pages render without console errors, which a page
 * showing an empty state passes just as happily as one showing data. That is exactly the
 * failure mode of changing a response shape: nothing throws, the list is simply empty.
 *
 * So this seeds real rows through the API and then checks they are visible in the browser.
 *
 * Needs backend (3101) and web (5173) running:
 *   node e2e/envelope-render.probe.mjs
 */
import { BACKEND_URL, WEB_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep } from './helpers.mjs';

const SITE = 'https://envelope-probe.example.com';

await waitForServers();
const { token, user, email } = await registerUser();

const api = (path, opts = {}) => fetch(`${BACKEND_URL}/api${path}`, {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...opts,
});

// Seed through the API, and check the write path answers in the new shape too.
const created = await (await api('/websites', {
  method: 'POST',
  body: JSON.stringify({ url: SITE, name: 'Envelope Probe' }),
})).json();
console.log(`POST /websites  → ${JSON.stringify(created).slice(0, 80)}`);
console.log(`  enveloped: ${created.success === true && 'data' in created ? 'yes' : 'NO'}`);

const { browser, page, errors } = await launchAuthedBrowser({ user, token });

/** Does this route show the seeded row, or an empty state? */
async function shows(path, needle) {
  await page.goto(`${WEB_URL}${path}`, { waitUntil: 'networkidle0' });
  await sleep(2500);
  const text = await page.evaluate(() => document.body.innerText);
  const found = text.includes(needle);
  console.log(`  ${path.padEnd(18)} ${found ? `✓ shows "${needle}"` : `✗ MISSING "${needle}"`}`);
  return found;
}

try {
  console.log('\nreading it back in the browser:');
  const results = [
    await shows('/websites', 'envelope-probe.example.com'),
    await shows('/dashboard', 'envelope-probe.example.com'),
  ];

  // The settings page reads /auth/me-ish data; a broken unwrap shows a blank name field.
  await page.goto(`${WEB_URL}/settings`, { waitUntil: 'networkidle0' });
  await sleep(2000);
  const settings = await page.evaluate(() => document.body.innerText);
  const hasEmail = settings.includes('@');
  console.log(`  /settings          ${hasEmail ? '✓ shows the account' : '✗ account details missing'}`);

  console.log(`\n${results.every(Boolean) && hasEmail ? 'PASS — enveloped reads still render.' : 'FAIL — something came back empty.'}`);
  console.log(`console errors: ${errors.length ? errors.map((e) => e.text).slice(0, 3).join(' | ') : 'none'}`);
} finally {
  await browser.close();
  await cleanupUser(email);
}
