import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TeamRole, TeamSummary } from '@perfscope/shared';

/**
 * Which account the app is looking at.
 *
 * Null is not a missing value — it is **your own data**, which is where everyone starts and
 * where everyone lands when a team goes away. The id travels on every request as a header
 * (`shared/api/client.ts`) and on the socket handshake, and the server resolves it to the
 * team owner; nothing in the client re-scopes anything itself.
 *
 * In `shared/` beside the palette store for the same reason that one is: the sidebar
 * switches the team and pages read the role to decide what to disable, and a widget may not
 * import a feature's store through another widget.
 */
interface TeamStore {
  teamId:   string | null;
  teamName: string;
  /** What this account may do in that team. `owner` when working alone — your own data. */
  role:     TeamRole;
  enter:    (team: TeamSummary | null) => void;
}

export const useTeamStore = create<TeamStore>()(
  persist(
    (set) => ({
      teamId:   null,
      teamName: '',
      role:     'owner',
      enter: (team) => set(
        team
          ? { teamId: team.id, teamName: team.name, role: team.role }
          : { teamId: null, teamName: '', role: 'owner' },
      ),
    }),
    { name: 'perfscope-team' },
  ),
);

/** The header value for a request made right now — read outside React, so the api client
 *  and the socket factory do not have to be components. */
export const activeTeamId = () => useTeamStore.getState().teamId;

/** Whether the current view may change anything. Read by pages to disable what a viewer
 *  cannot use, so a read-only member is told *before* the server answers 403. */
export const useCanEdit = () => useTeamStore(s => s.role !== 'viewer');
