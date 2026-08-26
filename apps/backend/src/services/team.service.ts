/**
 * Who may act as whom.
 *
 * A team is permission to work inside its **owner's** account (see `types/team.ts`), so
 * everything here answers one question in two forms: given a person and a team id, what is
 * the user id their queries should run against, and what are they allowed to do with it.
 *
 * **The cache is not an optimisation, it is the design being kept.** `requireAuth` verifies
 * a JWT and reads no database — that is why a request costs nothing before it does its
 * work. Resolving a team would add a read to *every* request that carries the header, so
 * membership is cached for a few seconds per (user, team). A role change therefore takes
 * effect within `SCOPE_TTL_MS`, which is the same trade the 30-minute access token already
 * makes for revocation, at a far shorter horizon.
 */
import { createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import {
  INVITE_TTL_DAYS, MAX_TEAMS_PER_USER, canManage,
  type TeamRole, type TeamDetail, type TeamInvitePreview, type TeamSummary,
} from '@perfscope/shared';
import { config } from '../config/index.js';
import { Team, type TeamDoc } from '../models/Team.model.js';
import { TeamInvite } from '../models/TeamInvite.model.js';
import { User } from '../models/User.model.js';
import { AppError } from '../lib/errors.js';

/** What a resolved request knows about the account it is acting on. */
export interface TeamScope {
  /** The user whose documents this request reads and writes. */
  scopeId: string;
  /** The person behind the request — for attribution, never for scoping. */
  actorId: string;
  teamId:  string | null;
  role:    TeamRole;
  teamName: string;
}

/** Working alone: your own data, and nothing you cannot do to it. */
export function personalScope(actorId: string): TeamScope {
  return { scopeId: actorId, actorId, teamId: null, role: 'owner', teamName: '' };
}

const SCOPE_TTL_MS = 15_000;

interface CachedScope { scope: TeamScope | null; at: number }
const scopeCache = new Map<string, CachedScope>();

/** Dropped on every membership change so the person who was just promoted is not told to
 *  wait fifteen seconds for a button to appear. */
export function forgetTeamScopes(teamId: string): void {
  for (const [key, value] of scopeCache) {
    if (value.scope?.teamId === teamId || key.endsWith(`:${teamId}`)) scopeCache.delete(key);
  }
}

const hashOf  = (raw: string) => createHash('sha256').update(raw).digest('hex');
const isOid   = (value: string) => /^[a-f\d]{24}$/i.test(value);
const memberOf = (team: TeamDoc, userId: string) =>
  team.members.find(m => String(m.userId) === userId);

/**
 * The scope a request runs under, or null when this person is not in that team.
 *
 * Null rather than a throw: a stale team id in a client's localStorage is an ordinary
 * thing — somebody was removed while a tab was open — and the right answer is to fall back
 * to personal, not to break every request the tab makes.
 */
export async function resolveTeamScope(actorId: string, teamId: string): Promise<TeamScope | null> {
  if (!isOid(teamId)) return null;

  const key    = `${actorId}:${teamId}`;
  const cached = scopeCache.get(key);
  if (cached && Date.now() - cached.at < SCOPE_TTL_MS) return cached.scope;

  const team   = await Team.findById(teamId);
  const member = team ? memberOf(team, actorId) : undefined;
  const scope: TeamScope | null = team && member
    ? {
        scopeId:  String(team.ownerId),
        actorId,
        teamId:   String(team._id),
        role:     member.role,
        teamName: team.name,
      }
    : null;

  scopeCache.set(key, { scope, at: Date.now() });
  return scope;
}

/** The teams this person can enter, newest first, with their own role in each. */
export async function listTeams(actorId: string): Promise<TeamSummary[]> {
  const teams  = await Team.find({ 'members.userId': actorId }).sort({ createdAt: -1 });
  const owners = await User.find({ _id: { $in: teams.map(t => t.ownerId) } }).select('name');
  const nameOf = new Map(owners.map(u => [String(u._id), u.name]));

  return teams.map(team => ({
    id:        String(team._id),
    name:      team.name,
    role:      memberOf(team, actorId)?.role ?? 'viewer',
    members:   team.members.length,
    ownerName: nameOf.get(String(team.ownerId)) ?? '',
  }));
}

/** One team with its people. Only for someone already in it — the route checks that. */
export async function describeTeam(team: TeamDoc, actorId: string): Promise<TeamDetail> {
  const users  = await User.find({ _id: { $in: team.members.map(m => m.userId) } }).select('name email');
  const byId   = new Map(users.map(u => [String(u._id), u]));

  return {
    id:        String(team._id),
    name:      team.name,
    ownerId:   String(team.ownerId),
    role:      memberOf(team, actorId)?.role ?? 'viewer',
    members:   team.members.length,
    ownerName: byId.get(String(team.ownerId))?.name ?? '',
    createdAt: team.createdAt.toISOString(),
    memberList: team.members.map(m => ({
      userId:   String(m.userId),
      name:     byId.get(String(m.userId))?.name ?? 'Removed account',
      email:    byId.get(String(m.userId))?.email ?? '',
      role:     m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
}

/**
 * A new team, owned by its creator.
 *
 * The creator is written into `members` with role `owner` rather than being implied by
 * `ownerId`: every permission check then reads one list, and there is no second path that
 * could disagree with it.
 */
export async function createTeam(actorId: string, name: string): Promise<TeamDoc> {
  const clean = name.trim();
  if (!clean) throw new AppError(400, 'A team needs a name');

  const owned = await Team.countDocuments({ ownerId: actorId });
  if (owned >= MAX_TEAMS_PER_USER) {
    throw new AppError(400, `A single account may own ${MAX_TEAMS_PER_USER} teams`);
  }

  return Team.create({
    ownerId: actorId,
    name:    clean.slice(0, 60),
    members: [{ userId: new Types.ObjectId(actorId), role: 'owner', joinedAt: new Date() }],
  });
}

/** The team, if this person is in it — otherwise the same 404 a stranger gets. Membership
 *  is not something an outsider should be able to probe for. */
export async function teamForMember(teamId: string, actorId: string): Promise<TeamDoc> {
  const team = isOid(teamId) ? await Team.findById(teamId) : null;
  if (!team || !memberOf(team, actorId)) throw new AppError(404, 'Team not found');
  return team;
}

/** The same, but only for someone who may administer it. */
export async function teamForManager(teamId: string, actorId: string): Promise<TeamDoc> {
  const team = await teamForMember(teamId, actorId);
  const role = memberOf(team, actorId)!.role;
  if (!canManage(role)) throw new AppError(403, 'Only the team owner can do that');
  return team;
}

/**
 * Mint an invite link. The token is returned exactly once — only its hash is kept.
 */
export async function createInvite(team: TeamDoc, actorId: string, role: TeamRole) {
  if (role === 'owner') throw new AppError(400, 'A team has one owner');

  const token   = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invite = await TeamInvite.create({
    teamId: team._id, tokenHash: hashOf(token), role,
    invitedBy: actorId, expiresAt: expires,
  });

  return { invite, url: `${config.clientUrl}/invite/${token}` };
}

/** What the accept page shows before anyone commits. Never says which team a spent or
 *  expired token belonged to — an invalid token proves nothing about anything. */
export async function previewInvite(token: string): Promise<TeamInvitePreview> {
  const invite = await TeamInvite.findOne({ tokenHash: hashOf(token) });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { team: '', role: 'viewer', invitedBy: '', valid: false };
  }

  const [team, inviter] = await Promise.all([
    Team.findById(invite.teamId),
    User.findById(invite.invitedBy).select('name'),
  ]);
  if (!team) return { team: '', role: 'viewer', invitedBy: '', valid: false };

  return { team: team.name, role: invite.role, invitedBy: inviter?.name ?? '', valid: true };
}

/**
 * Spend an invite and join its team.
 *
 * Already a member is a success, not an error: two people forwarding the same link, or a
 * double-clicked button, should land on the team rather than on a failure page. The invite
 * is still burned, because it was used.
 */
export async function acceptInvite(token: string, actorId: string): Promise<TeamDoc> {
  const invite = await TeamInvite.findOne({ tokenHash: hashOf(token) });
  if (!invite) throw new AppError(404, 'That invitation link is not valid');
  if (invite.usedAt) throw new AppError(400, 'That invitation has already been used');
  if (invite.expiresAt < new Date()) throw new AppError(400, 'That invitation has expired');

  const team = await Team.findById(invite.teamId);
  if (!team) throw new AppError(404, 'That team no longer exists');

  if (!memberOf(team, actorId)) {
    team.members.push({ userId: new Types.ObjectId(actorId), role: invite.role, joinedAt: new Date() });
    await team.save();
  }

  invite.usedAt = new Date();
  invite.usedBy = new Types.ObjectId(actorId);
  await invite.save();

  forgetTeamScopes(String(team._id));
  return team;
}

/** Change what someone may do. The owner's own row is not editable — a team without an
 *  owner has nobody who can invite, remove or delete it. */
export async function setMemberRole(team: TeamDoc, userId: string, role: TeamRole): Promise<void> {
  if (String(team.ownerId) === userId) throw new AppError(400, "The owner's role cannot be changed");
  if (role === 'owner') throw new AppError(400, 'A team has one owner');

  const member = memberOf(team, userId);
  if (!member) throw new AppError(404, 'That person is not on this team');

  member.role = role;
  await team.save();
  forgetTeamScopes(String(team._id));
}

/**
 * Remove somebody, or leave.
 *
 * The owner can do neither: their account *is* the team's data, so "leaving" would mean
 * handing everyone else a workspace nobody administers. Deleting the team is the way out,
 * and it is the one action that costs no data.
 */
export async function removeMember(team: TeamDoc, userId: string): Promise<void> {
  if (String(team.ownerId) === userId) {
    throw new AppError(400, 'The owner cannot leave their own team — delete it instead');
  }
  if (!memberOf(team, userId)) throw new AppError(404, 'That person is not on this team');

  team.members = team.members.filter(m => String(m.userId) !== userId);
  await team.save();
  forgetTeamScopes(String(team._id));
}
