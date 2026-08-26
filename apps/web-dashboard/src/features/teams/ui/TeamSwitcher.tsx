import { Link } from 'react-router-dom';
import { Check, ChevronDown, Eye, User, Users } from 'lucide-react';
import type { TeamSummary } from '@perfscope/shared';
import { useTeamStore } from '@/shared/model/teamStore';
import { useEnterTeam, useTeams } from '../model/useTeams';

/**
 * Which account the workspace is showing, and how to change it.
 *
 * Sits in the sidebar under the brand because it re-labels everything below it: the sites,
 * the history, the flows and the alerts are all read from whichever account is selected
 * here. "Personal" leads and is always present — it is where a person's own data lives and
 * where they land when a team is deleted or their membership ends.
 *
 * Written open rather than with the Radix `Select` primitive: this is a menu with a footer
 * link and per-row secondary text, and `Select` is a form control that owns its own
 * keyboard model. A `<details>` gives the same one-key open/close for free.
 */
export function TeamSwitcher() {
  const { teams } = useTeams();
  const { teamId, teamName, role } = useTeamStore();
  const enterTeam = useEnterTeam();

  // Nothing to switch between and nothing to explain: a person who has never been in a
  // team should not be asked to think about which account they are in.
  if (teams.length === 0) return null;

  const active = teams.find(t => t.id === teamId) ?? null;
  const label  = active ? active.name : teamName && teamId ? teamName : 'Personal';

  function choose(team: TeamSummary | null) {
    enterTeam(team);
    // Closes the menu: `open` is uncontrolled, so the summary click that opened it is undone
    // by removing the attribute the browser set.
    document.querySelector<HTMLDetailsElement>('[data-team-switcher]')?.removeAttribute('open');
  }

  return (
    <details data-team-switcher className="group relative px-1 pb-3">
      <summary
        className="flex items-center gap-2 px-2 py-[7px] rounded-[10px] cursor-pointer list-none
                   border border-ld-border bg-ld-surface hover:border-ld-accent-line transition-colors
                   [&::-webkit-details-marker]:hidden"
      >
        {teamId ? <Users className="w-[14px] h-[14px] text-ld-accent shrink-0" />
                : <User  className="w-[14px] h-[14px] text-ld-text-3 shrink-0" />}
        <span className="flex-1 min-w-0 truncate text-[12.5px] font-semibold text-ld-text">{label}</span>
        {teamId && role === 'viewer' && (
          <span className="inline-flex items-center gap-[3px] text-[10.5px] font-semibold text-ld-text-3">
            <Eye className="w-[11px] h-[11px]" /> view
          </span>
        )}
        <ChevronDown className="w-[13px] h-[13px] text-ld-text-3 shrink-0 transition-transform group-open:rotate-180" />
      </summary>

      <div className="absolute left-1 right-1 z-30 mt-1 p-1 rounded-[12px] border border-ld-border bg-ld-surface-2 shadow-lg">
        <Row label="Personal" hint="Only you" active={!teamId} onSelect={() => choose(null)} />
        {teams.map(team => (
          <Row
            key={team.id}
            label={team.name}
            hint={`${team.members} member${team.members === 1 ? '' : 's'} · ${team.role}`}
            active={team.id === teamId}
            onSelect={() => choose(team)}
          />
        ))}
        <Link
          to="/team"
          className="block px-[10px] py-[7px] mt-1 border-t border-ld-border text-[11.5px] text-ld-text-3 hover:text-ld-accent"
        >
          Manage teams
        </Link>
      </div>
    </details>
  );
}

function Row({ label, hint, active, onSelect }: {
  label: string; hint: string; active: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-2 px-[10px] py-[7px] rounded-[9px] text-left
                 hover:bg-ld-surface-hover transition-colors"
    >
      <span className="flex-1 min-w-0">
        <span className="block truncate text-[12.5px] font-semibold text-ld-text">{label}</span>
        <span className="block truncate text-[11px] text-ld-text-3">{hint}</span>
      </span>
      {active && <Check className="w-[13px] h-[13px] text-ld-accent shrink-0" />}
    </button>
  );
}
