import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';

vi.mock('./auth.middleware.js', () => ({
  userIdFromToken: (token: string | undefined) => (token === 'good' ? 'actor-1' : undefined),
}));
vi.mock('../config/database.js', () => ({ isDbReady: () => true }));

const resolveTeamScope = vi.fn();
vi.mock('../services/team.service.js', () => ({ resolveTeamScope: (...a: unknown[]) => resolveTeamScope(...a) }));

const { attachTeamScope } = await import('./teamScope.js');
type Req = Parameters<typeof attachTeamScope>[0];

const request = (over: Partial<Req> = {}): Req => ({
  headers: { authorization: 'Bearer good' },
  method:  'GET',
  path:    '/websites',
  ...over,
} as Req);

const run = async (req: Req) => {
  const next = vi.fn() as unknown as NextFunction;
  await attachTeamScope(req, {} as Response, next);
  return (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
};

const scope = (role: string) => ({ scopeId: 'owner-9', actorId: 'actor-1', teamId: 'team-1', role, teamName: 'Acme' });

beforeEach(() => resolveTeamScope.mockReset());

describe('attachTeamScope', () => {
  it('resolves a member onto the team owner, so every query reads the owner rows', () => {
    resolveTeamScope.mockResolvedValue(scope('member'));
    const req = request({ headers: { authorization: 'Bearer good', 'x-team-id': 'team-1' } } as Partial<Req>);

    return run(req).then(err => {
      expect(err).toBeUndefined();
      expect(req.scopeUserId).toBe('owner-9');
      expect(req.actorId).toBe('actor-1');
      expect(req.teamRole).toBe('member');
    });
  });

  it('leaves a request with no team header alone', async () => {
    await run(request());
    expect(resolveTeamScope).not.toHaveBeenCalled();
  });

  it('falls back to personal when the caller is not in the team', async () => {
    // Somebody removed while a tab was open: their next request must read their own data,
    // not fail. A stale id in localStorage is an ordinary thing, not an attack.
    resolveTeamScope.mockResolvedValue(null);
    const req = request({ headers: { authorization: 'Bearer good', 'x-team-id': 'team-1' } } as Partial<Req>);

    expect(await run(req)).toBeUndefined();
    expect(req.scopeUserId).toBeUndefined();
    expect(req.teamRole).toBeUndefined();
  });

  it('refuses a write from a viewer', async () => {
    resolveTeamScope.mockResolvedValue(scope('viewer'));
    const req = request({
      method: 'POST', path: '/websites',
      headers: { authorization: 'Bearer good', 'x-team-id': 'team-1' },
    } as Partial<Req>);

    expect(await run(req)).toMatchObject({ status: 403, code: 'TEAM_READ_ONLY' });
  });

  it('still lets a viewer read', async () => {
    resolveTeamScope.mockResolvedValue(scope('viewer'));
    const req = request({ headers: { authorization: 'Bearer good', 'x-team-id': 'team-1' } } as Partial<Req>);
    expect(await run(req)).toBeUndefined();
  });

  it('lets a viewer leave the team they can only read', async () => {
    // Membership routes are the exception: accepting an invite and leaving are writes about
    // the person, not about the account's data.
    resolveTeamScope.mockResolvedValue(scope('viewer'));
    const req = request({
      method: 'DELETE', path: '/teams/team-1/members/actor-1',
      headers: { authorization: 'Bearer good', 'x-team-id': 'team-1' },
    } as Partial<Req>);

    expect(await run(req)).toBeUndefined();
  });

  it('ignores a team header on a request with no token', async () => {
    const req = request({ headers: { 'x-team-id': 'team-1' } } as Partial<Req>);
    await run(req);
    expect(resolveTeamScope).not.toHaveBeenCalled();
    expect(req.scopeUserId).toBeUndefined();
  });
});
