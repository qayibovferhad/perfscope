import { Router } from 'express';
import { ok } from '../lib/respond.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { requireStorageForWrites } from '../middleware/storage.middleware.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import type { ScopedRequest } from '../middleware/teamScope.js';
import { TeamInvite } from '../models/TeamInvite.model.js';
import { User } from '../models/User.model.js';
import {
  acceptInvite, createInvite, createTeam, describeTeam, listTeams,
  previewInvite, removeMember, setMemberRole, teamForManager, teamForMember,
} from '../services/team.service.js';
import { TEAM_ROLES, type TeamInviteInfo, type TeamRole } from '@perfscope/shared';

export const teamRouter: Router = Router();

/**
 * Teams, and the invitations that fill them.
 *
 * Every other router in this app works on `req.userId`, which inside a team is the
 * **owner's** id — that is what makes a member see the owner's sites. These routes are the
 * exception: they are about the person, so they read `req.actorId`. Getting that backwards
 * would let a member administer a team through the owner's identity.
 */
teamRouter.use('/teams', requireAuth, requireStorageForWrites);
teamRouter.use('/invites', requireAuth, requireStorageForWrites);

type Req = AuthedRequest & ScopedRequest;

/** The person, never the account they are acting on. */
const actor = (req: Req) => req.actorId ?? req.userId;

const param = (req: { params: Record<string, unknown> }, key: string) => String(req.params[key] ?? '');

const asRole = (raw: unknown): TeamRole => {
  if (raw === 'member' || raw === 'viewer') return raw;
  throw new AppError(400, `role must be one of ${TEAM_ROLES.filter(r => r !== 'owner').join(', ')}`);
};

teamRouter.get('/teams', asyncHandler<Req>(async (req, res) => {
  ok(res, await listTeams(actor(req)));
}));

teamRouter.post('/teams', asyncHandler<Req>(async (req, res) => {
  const team = await createTeam(actor(req), String((req.body as { name?: unknown }).name ?? ''));
  ok(res, await describeTeam(team, actor(req)), 201);
}));

teamRouter.get('/teams/:id', asyncHandler<Req>(async (req, res) => {
  const team = await teamForMember(param(req, 'id'), actor(req));
  ok(res, await describeTeam(team, actor(req)));
}));

teamRouter.patch('/teams/:id', asyncHandler<Req>(async (req, res) => {
  const team = await teamForManager(param(req, 'id'), actor(req));
  const name = String((req.body as { name?: unknown }).name ?? '').trim();
  if (!name) throw new AppError(400, 'A team needs a name');

  team.name = name.slice(0, 60);
  await team.save();
  ok(res, await describeTeam(team, actor(req)));
}));

/**
 * Deleting a team deletes **no audits, sites or flows** — they belong to the owner's
 * account and always did. What it removes is everyone else's access to it, which is the
 * only thing the team ever was.
 */
teamRouter.delete('/teams/:id', asyncHandler<Req>(async (req, res) => {
  const team = await teamForManager(param(req, 'id'), actor(req));
  await TeamInvite.deleteMany({ teamId: team._id });
  await team.deleteOne();
  ok(res, { deleted: true });
}));

teamRouter.patch('/teams/:id/members/:userId', asyncHandler<Req>(async (req, res) => {
  const team = await teamForManager(param(req, 'id'), actor(req));
  await setMemberRole(team, param(req, 'userId'), asRole((req.body as { role?: unknown }).role));
  ok(res, await describeTeam(team, actor(req)));
}));

/** Removing someone else needs the owner; removing yourself is leaving, and needs nothing
 *  but membership — a viewer who was added to a team can always get out of it. */
teamRouter.delete('/teams/:id/members/:userId', asyncHandler<Req>(async (req, res) => {
  const me     = actor(req);
  const target = param(req, 'userId');
  const team   = target === me
    ? await teamForMember(param(req, 'id'), me)
    : await teamForManager(param(req, 'id'), me);

  await removeMember(team, target);
  ok(res, { removed: true });
}));

teamRouter.get('/teams/:id/invites', asyncHandler<Req>(async (req, res) => {
  const team    = await teamForManager(param(req, 'id'), actor(req));
  const invites = await TeamInvite.find({ teamId: team._id, usedAt: null }).sort({ createdAt: -1 });
  const inviters = await User.find({ _id: { $in: invites.map(i => i.invitedBy) } }).select('name');
  const nameOf   = new Map(inviters.map(u => [String(u._id), u.name]));

  // No `url`: the token is stored hashed, so a link can be minted or revoked but never
  // read back. An owner who lost one revokes it and makes another.
  ok(res, invites.map((invite): TeamInviteInfo => ({
    id:        String(invite._id),
    role:      invite.role,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    invitedBy: nameOf.get(String(invite.invitedBy)) ?? '',
  })));
}));

teamRouter.post('/teams/:id/invites', asyncHandler<Req>(async (req, res) => {
  const team = await teamForManager(param(req, 'id'), actor(req));
  const { invite, url } = await createInvite(team, actor(req), asRole((req.body as { role?: unknown }).role));

  ok(res, {
    id:        String(invite._id),
    role:      invite.role,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    invitedBy: '',
    url,
  } satisfies TeamInviteInfo, 201);
}));

teamRouter.delete('/teams/:id/invites/:inviteId', asyncHandler<Req>(async (req, res) => {
  const team = await teamForManager(param(req, 'id'), actor(req));
  await TeamInvite.deleteOne({ _id: param(req, 'inviteId'), teamId: team._id });
  ok(res, { revoked: true });
}));

/** What the link shows before anyone joins anything. */
teamRouter.get('/invites/:token', asyncHandler<Req>(async (req, res) => {
  ok(res, await previewInvite(param(req, 'token')));
}));

teamRouter.post('/invites/:token/accept', asyncHandler<Req>(async (req, res) => {
  const team = await acceptInvite(param(req, 'token'), actor(req));
  ok(res, await describeTeam(team, actor(req)));
}));
