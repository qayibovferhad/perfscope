/**
 * The team UI, in a real browser.
 *
 * `teams.probe.mjs` proves the server resolves a member onto the owner's account. This
 * proves the part a person actually meets: that the sidebar says which account they are
 * looking at, that an invite link is shown exactly once and can be copied, and that a
 * viewer is told they cannot write *before* they fill anything in rather than by a 403.
 *
 *   node e2e/teams-ui.probe.mjs        (backend and web dev server must be running)
 */
import { BACKEND_URL, WEB_URL, launchAuthedBrowser, registerUser, waitForServers, cleanupUser } from './helpers.mjs';

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

async function api(path, { token, teamId, method = 'GET', body } = {}) {
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(teamId ? { 'X-Team-Id': teamId } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return (await res.json().catch(() => ({}))).data;
}

const text = (page) => page.evaluate(() => document.body.innerText);

await waitForServers();

const owner  = await registerUser();
const viewer = await registerUser();
let browser;

try {
  await api('/websites', {
    token: owner.token, method: 'POST',
    body: { name: 'Teams UI probe', url: `https://teams-ui-${Date.now()}.test/` },
  });
  const team = await api('/teams', { token: owner.token, method: 'POST', body: { name: 'Probe Crew' } });

  // ── The owner's view ─────────────────────────────────────────────────────
  const owned = await launchAuthedBrowser(owner);
  browser = owned.browser;
  const page = owned.page;

  await page.goto(`${WEB_URL}/team`, { waitUntil: 'networkidle2' });
  const teamPage = await text(page);
  check(teamPage.includes('Probe Crew'), 'the team page lists the team');
  check(teamPage.includes('Delete this team'), 'and the owner is offered its administration');

  // Minting a link, which the page shows exactly once.
  const createLink = await page.$$eval('button', (buttons) => {
    const target = buttons.find(b => b.textContent?.trim() === 'Create link');
    if (target) target.click();
    return !!target;
  });
  check(createLink, 'the owner can create an invite link');
  await new Promise(r => setTimeout(r, 1200));
  check((await text(page)).includes('/invite/'), 'and the link is shown for copying');

  // The switcher only appears once there is somewhere to switch to.
  await page.goto(`${WEB_URL}/dashboard`, { waitUntil: 'networkidle2' });
  check((await text(page)).includes('Personal'), 'the sidebar names the account being viewed');

  await browser.close();
  browser = undefined;

  // ── A viewer's view ──────────────────────────────────────────────────────
  const invite = await api(`/teams/${team.id}/invites`, {
    token: owner.token, method: 'POST', body: { role: 'viewer' },
  });
  const inviteToken = invite.url.split('/invite/')[1];

  const guest = await launchAuthedBrowser(viewer);
  browser = guest.browser;
  const guestPage = guest.page;

  await guestPage.goto(`${WEB_URL}/invite/${inviteToken}`, { waitUntil: 'networkidle2' });
  const invitePage = await text(guestPage);
  check(invitePage.includes('Probe Crew'), 'the invite page names the team before joining');
  check(invitePage.includes('viewer'), 'and the role being offered');

  const joined = await guestPage.$$eval('button', (buttons) => {
    const target = buttons.find(b => b.textContent?.includes('Join'));
    if (target) target.click();
    return !!target;
  });
  check(joined, 'the invitation can be accepted from the page');
  await new Promise(r => setTimeout(r, 2000));

  const afterJoin = await text(guestPage);
  check(afterJoin.includes('Probe Crew'), 'and the sidebar switches to the team just joined');
  check(afterJoin.includes('view'), 'which is marked view-only');

  const addDisabled = await guestPage.$$eval('button', (buttons) =>
    buttons.some(b => b.textContent?.includes('Add Website') && b.disabled));
  check(addDisabled, "a viewer's primary action is disabled, not left to fail with a 403");

  const stale = [...owned.errors, ...guest.errors].filter(e => !/favicon|404/i.test(e.text));
  check(stale.length === 0, `no console errors (${stale.length})${stale[0] ? `: ${stale[0].text}` : ''}`);
} finally {
  await browser?.close();
  for (const who of [owner, viewer]) {
    for (const team of (await api('/teams', { token: who.token })) ?? []) {
      await api(`/teams/${team.id}`, { token: who.token, method: 'DELETE' });
    }
    await cleanupUser(who.email);
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
