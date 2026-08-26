import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../middleware/auth.middleware.js', () => ({
  userIdFromToken: (token: string | undefined) => (token === 'good' ? 'actor-1' : undefined),
}));
vi.mock('../config/database.js', () => ({ isDbReady: () => true }));

const resolveTeamScope = vi.fn();
vi.mock('../services/team.service.js', () => ({ resolveTeamScope: (...a: unknown[]) => resolveTeamScope(...a) }));

const { socketScope } = await import('./scope.js');

beforeEach(() => resolveTeamScope.mockReset());

describe('socketScope', () => {
  it('resolves an audit onto the team owner, so it is stored in that account', async () => {
    resolveTeamScope.mockResolvedValue({ scopeId: 'owner-9' });
    expect(await socketScope({ token: 'good', teamId: 'team-1' })()).toBe('owner-9');
  });

  it('is the person themselves with no team on the handshake', async () => {
    expect(await socketScope({ token: 'good' })()).toBe('actor-1');
    expect(resolveTeamScope).not.toHaveBeenCalled();
  });

  it('falls back to the person when they are no longer in that team', async () => {
    resolveTeamScope.mockResolvedValue(null);
    expect(await socketScope({ token: 'good', teamId: 'team-1' })()).toBe('actor-1');
  });

  it('is undefined without a token — a socket may connect signed out', async () => {
    expect(await socketScope({ teamId: 'team-1' })()).toBeUndefined();
  });

  it('reads the database once however many events the connection sends', async () => {
    // Memoised on purpose: a connection running five flows must not re-resolve five times,
    // and every handler awaits this before it does anything.
    resolveTeamScope.mockResolvedValue({ scopeId: 'owner-9' });
    const scope = socketScope({ token: 'good', teamId: 'team-1' });

    await Promise.all([scope(), scope(), scope()]);
    expect(resolveTeamScope).toHaveBeenCalledTimes(1);
  });
});
