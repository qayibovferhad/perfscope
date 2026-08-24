/**
 * A session that renews itself, and one that can be ended.
 *
 * Access tokens last thirty minutes now, so the ordinary state of a dashboard somebody
 * comes back to is one whose token has already expired. The thing worth proving is that
 * this is *invisible*: the page loads its data, the reader is not bounced to /login, and
 * the stored token has quietly become a different one. Then the other half — that signing
 * out actually ends the session on the server, which is what the old "clear localStorage"
 * sign-out never did.
 *
 * The expired token is signed by hand rather than waited for. Thirty minutes is not a
 * thing a probe can sit through, and an expired JWT is trivially constructible.
 *
 *   node e2e/auth-refresh.probe.mjs
 */
import {
  WEB_URL, BACKEND_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers,
  sleep, signToken, bodyText,
} from './helpers.mjs';

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

const authState = (page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('perfscope-auth') ?? '{}').state ?? null; }
  catch { return null; }
});

const post = (path, body) => fetch(`${BACKEND_URL}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

await waitForServers();
const { refreshToken, user, email } = await registerUser();

check(!!refreshToken, 'registering issues a refresh token alongside the access token');

// An access token that expired a minute ago, signed with the same dev secret the backend
// falls back to. Everything else about it is a real token.
const expired = signToken({
  sub: user.sub, email: user.email, name: user.name,
  iat: Math.floor(Date.now() / 1000) - 3600,
  exp: Math.floor(Date.now() / 1000) - 60,
});

const { browser, page, errors } = await launchAuthedBrowser({ user, token: expired, refreshToken });

try {
  // ─── The renewal nobody sees ───────────────────────────────────────────────
  await page.goto(`${WEB_URL}/websites`, { waitUntil: 'networkidle0' });
  await sleep(2500);

  check(new URL(page.url()).pathname === '/websites', `an expired token does not bounce to the login page (${new URL(page.url()).pathname})`);
  check(!/session expired/i.test(await bodyText(page)), 'and says nothing about a session expiring');

  const after = await authState(page);
  check(!!after?.token && after.token !== expired, 'the stored access token has been replaced');
  check(!!after?.refreshToken && after.refreshToken !== refreshToken,
    'and the refresh token was rotated — the one just spent is not kept');

  // The page has to have actually loaded data with the new token, not merely stayed on the
  // route: rendering an error panel would also leave the URL alone.
  const text = await bodyText(page);
  check(!/could not load|did not respond/i.test(text), 'the page loaded its data with the renewed token');

  // ─── The spent token is dead ───────────────────────────────────────────────
  const replay = await post('/api/auth/refresh', { refreshToken });
  check(replay.status === 401, `replaying the spent refresh token is refused (${replay.status})`);

  // Reuse takes the family down, so the renewed one is gone too — the session is over and
  // the reader signs in again. That is the deliberate answer to "somebody has a copy".
  const successor = await post('/api/auth/refresh', { refreshToken: after.refreshToken });
  check(successor.status === 401, 'and takes the successor with it — a reused token ends the family');

  // ─── Signing out ends it on the server ─────────────────────────────────────
  const second = await registerUser();
  const live = await post('/api/auth/refresh', { refreshToken: second.refreshToken });
  check(live.status === 200, 'a fresh session refreshes normally');
  const rotated = (await live.json()).data.refreshToken;

  const out = await post('/api/auth/logout', { refreshToken: rotated });
  check(out.status === 200, 'signing out is accepted');
  const afterLogout = await post('/api/auth/refresh', { refreshToken: rotated });
  check(afterLogout.status === 401, 'and the session no longer refreshes — not just cleared locally');

  const unknown = await post('/api/auth/logout', { refreshToken: 'never-issued' });
  check(unknown.status === 200, 'signing out a token the server never issued still succeeds');

  await cleanupUser(second.email);

  // ─── Forgot password ───────────────────────────────────────────────────────
  const known   = await post('/api/auth/forgot-password', { email });
  const nobody  = await post('/api/auth/forgot-password', { email: 'no-such-account@probe.test' });
  check(known.status === 200 && nobody.status === 200,
    'a reset request answers the same way for a real address and an unknown one');
  check(JSON.stringify(await known.json()) === JSON.stringify(await nobody.json()),
    'down to the body — the form is not an account-existence oracle');

  const badToken = await post('/api/auth/reset-password', { token: 'not-a-real-token', password: 'whatever-123' });
  check(badToken.status === 400, 'a bad reset token is refused');

  // ─── The pages exist and say the right thing ───────────────────────────────
  await page.goto(`${WEB_URL}/forgot-password`, { waitUntil: 'networkidle0' });
  await sleep(1200);
  check(/reset link|forgot/i.test(await bodyText(page)), 'the forgot-password page renders');

  await page.evaluate(() => {
    const input = document.querySelector('input[type="email"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'someone@probe.test');
    input?.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('button[type="submit"]')?.click();
  });
  await sleep(1500);
  check(/on its way|check your inbox/i.test(await bodyText(page)),
    'and confirms without revealing whether that address has an account');

  await page.goto(`${WEB_URL}/reset-password`, { waitUntil: 'networkidle0' });
  await sleep(1200);
  check(/missing its token|request a new link/i.test(await bodyText(page)),
    'the reset page explains a link that arrived without its token');

  // The renewal is invisible to the *reader*, not to devtools: the browser logs every 401
  // response itself, before any interceptor sees it, and the whole point of this probe is
  // to start with a token that earns one. Those are expected; anything else is not.
  const expectedRenewal = /status of 401/i;
  const noisy = errors.filter(e => !/favicon/i.test(e.text) && !expectedRenewal.test(e.text));
  check(noisy.length === 0, `no unexpected console errors (${noisy.length}; ${errors.length - noisy.length} are the 401s that triggered the renewal)`);
  if (noisy.length) console.log(noisy.slice(0, 5));
} finally {
  await browser.close();
  await cleanupUser(email);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
