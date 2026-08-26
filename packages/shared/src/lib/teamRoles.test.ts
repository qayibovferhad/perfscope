import { describe, it, expect } from 'vitest';
import { canManage, canWrite, TEAM_ROLES } from '../types/team';

describe('team roles', () => {
  it('lets a member change things and a viewer only look', () => {
    expect(canWrite('owner')).toBe(true);
    expect(canWrite('member')).toBe(true);
    expect(canWrite('viewer')).toBe(false);
  });

  it('keeps administration to the owner', () => {
    // A member runs audits and edits sites; inviting people and handing out roles is the
    // one thing that can hand somebody else the whole account, so it stays with the owner.
    expect(canManage('owner')).toBe(true);
    expect(canManage('member')).toBe(false);
    expect(canManage('viewer')).toBe(false);
  });

  it('is ordered weakest first, which is what every comparison relies on', () => {
    expect(TEAM_ROLES).toEqual(['viewer', 'member', 'owner']);
  });
});
