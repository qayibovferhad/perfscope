/**
 * Teams, over the real HTTP surface.
 *
 * The claim being checked is the one the whole design rests on: **a member's request runs
 * against the owner's account**. Not a copy, not a synchronised mirror — the same document,
 * reached because the request was resolved to the owner's id before any query ran. If that
 * ever stops being true, a team silently becomes a second empty workspace and nobody
 * notices until somebody asks where their sites went.
 *
 * The rest is what the roles promise: a viewer cannot write, a member cannot administer,
 * somebody removed falls back to their own data rather than breaking, and deleting a team
 * costs the owner nothing.
 *
 *   node e2e/teams.probe.mjs           (backend must be running)
 */
import { BACKEND_URL, registerUser, waitForBackend } from './helpers.mjs';

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/** One request as a given person, optionally working inside a team. */
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
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json.data, error: json.error };
}

await waitForBackend();

const owner  = await registerUser();
const member = await registerUser();
const guest  = await registerUser();

const siteUrl = `https://teams-probe-${Date.now()}.test/`;

try {
  // ── The owner's own account, before any of this ──────────────────────────
  const site = await api('/websites', {
    token: owner.token, method: 'POST',
    body: { name: 'Probe site', url: siteUrl },
  });
  check(site.status === 201, 'the owner has a site of their own');

  // ── A team, and an invitation ────────────────────────────────────────────
  const team = await api('/teams', { token: owner.token, method: 'POST', body: { name: 'Probe Team' } });
  check(team.status === 201 && team.data.role === 'owner', 'creating a team makes you its owner');
  const teamId = team.data?.id;

  const invite = await api(`/teams/${teamId}/invites`, {
    token: owner.token, method: 'POST', body: { role: 'member' },
  });
  check(invite.status === 201 && typeof invite.data.url === 'string', 'an invite link is minted');
  const token = invite.data.url.split('/invite/')[1];

  const listed = await api(`/teams/${teamId}/invites`, { token: owner.token });
  check(
    listed.data?.[0] && listed.data[0].url === undefined,
    'listing invites never hands the link back — only its hash was stored',
  );

  const preview = await api(`/invites/${token}`, { token: member.token });
  check(preview.data?.valid === true && preview.data.team === 'Probe Team', 'the link previews the team before joining');

  const accepted = await api(`/invites/${token}/accept`, { token: member.token, method: 'POST' });
  check(accepted.status === 200 && accepted.data.members === 2, 'accepting joins the team');

  const spent = await api(`/invites/${token}/accept`, { token: guest.token, method: 'POST' });
  check(spent.status === 400, 'and the link is single use');

  // ── The claim: the member works inside the owner's account ───────────────
  const alone = await api('/websites', { token: member.token });
  check(alone.data?.length === 0, 'the member has nothing of their own');

  const inTeam = await api('/websites', { token: member.token, teamId });
  check(
    inTeam.data?.length === 1 && inTeam.data[0].url === siteUrl,
    "inside the team, the member reads the OWNER's sites — the same document, not a copy",
  );

  const wrote = await api('/websites', {
    token: member.token, teamId, method: 'POST',
    body: { name: 'Added by the member', url: `https://member-added-${Date.now()}.test/` },
  });
  check(wrote.status === 201, 'a member may write');

  const ownerSees = await api('/websites', { token: owner.token });
  check(ownerSees.data?.length === 2, "and what they wrote lands in the owner's account");

  // ── What a member may not do ─────────────────────────────────────────────
  const escalation = await api(`/teams/${teamId}/invites`, {
    token: member.token, teamId, method: 'POST', body: { role: 'member' },
  });
  check(escalation.status === 403, 'a member cannot invite people');

  // ── A viewer reads and nothing else ──────────────────────────────────────
  const viewerInvite = await api(`/teams/${teamId}/invites`, {
    token: owner.token, method: 'POST', body: { role: 'viewer' },
  });
  const viewerToken = viewerInvite.data.url.split('/invite/')[1];
  await api(`/invites/${viewerToken}/accept`, { token: guest.token, method: 'POST' });

  const viewerReads = await api('/websites', { token: guest.token, teamId });
  check(viewerReads.data?.length === 2, 'a viewer sees everything');

  const viewerWrites = await api('/websites', {
    token: guest.token, teamId, method: 'POST',
    body: { name: 'Nope', url: 'https://viewer-should-not.test/' },
  });
  check(viewerWrites.status === 403, 'a viewer cannot write');

  const viewerDeletes = await api(`/websites/${site.data.id ?? site.data._id}`, {
    token: guest.token, teamId, method: 'DELETE',
  });
  check(viewerDeletes.status === 403, 'and cannot delete');

  const viewerLeaves = await api(`/teams/${teamId}/members/${guest.user.sub}`, {
    token: guest.token, teamId, method: 'DELETE',
  });
  check(viewerLeaves.status === 200, 'but can always leave — membership is about the person');

  // ── Removal, and a header that no longer means anything ──────────────────
  const removed = await api(`/teams/${teamId}/members/${member.user.sub}`, {
    token: owner.token, method: 'DELETE',
  });
  check(removed.status === 200, 'the owner can remove somebody');

  // The cache is per (user, team) with a short TTL; a removal drops it immediately, which
  // is exactly what this asserts — no waiting.
  const afterRemoval = await api('/websites', { token: member.token, teamId });
  check(
    afterRemoval.status === 200 && afterRemoval.data.length === 0,
    'their next request with the old team header reads their own data, it does not fail',
  );

  const ownerLeaves = await api(`/teams/${teamId}/members/${owner.user.sub}`, {
    token: owner.token, method: 'DELETE',
  });
  check(ownerLeaves.status === 400, 'the owner cannot leave their own team');

  // ── Deleting a team costs no data ────────────────────────────────────────
  const deleted = await api(`/teams/${teamId}`, { token: owner.token, method: 'DELETE' });
  check(deleted.status === 200, 'the owner can delete the team');

  const stillThere = await api('/websites', { token: owner.token });
  check(stillThere.data?.length === 2, 'and every site the team touched is still the owner\'s');
} finally {
  // Whatever failed, the accounts and their sites go.
  for (const who of [owner, member, guest]) {
    const mine = await api('/websites', { token: who.token });
    for (const site of mine.data ?? []) {
      await api(`/websites/${site.id ?? site._id}`, { token: who.token, method: 'DELETE' });
    }
    for (const team of (await api('/teams', { token: who.token })).data ?? []) {
      await api(`/teams/${team.id}`, { token: who.token, method: 'DELETE' });
    }
  }
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/perfscope');
  await client.connect();
  await client.db().collection('users').deleteMany({ email: { $in: [owner.email, member.email, guest.email] } });
  await client.close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
