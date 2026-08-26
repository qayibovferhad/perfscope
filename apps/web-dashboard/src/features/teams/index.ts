/**
 * The teams feature's public surface.
 *
 * It has a barrel — most features here do not — because three layers above it need the same
 * two things: the sidebar (a widget) draws the switcher, and the team and invite pages read
 * the hooks. The FSD lint rule requires the barrel for exactly that reason: what a feature
 * exposes should be a decision, not whichever file somebody happened to reach for.
 */
export { TeamSwitcher } from './ui/TeamSwitcher';
export {
  useTeams, useTeam, useTeamInvites, useTeamActions,
  useEnterTeam, useInvitePreview, useAcceptInvite,
} from './model/useTeams';
