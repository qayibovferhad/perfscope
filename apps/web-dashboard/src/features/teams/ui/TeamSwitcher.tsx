import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronsUpDown, Eye, Settings2 } from 'lucide-react';
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
 * It used to be a bordered row that looked exactly like the search field two lines below
 * it, over a `<details>` that stayed open when you clicked away and gave every entry the
 * same grey. A workspace switcher is not a form control: it is *identity*, so each account
 * carries a monogram in its own colour, the trigger states the role you are holding, and
 * the menu is wider than the sidebar lane it drops out of.
 *
 * Controlled rather than `<details>`, following the house pattern (`ExportMenu`): outside
 * mousedown and Escape close it, which `details` cannot do on its own.
 */

/** Identity colours. Picked by name hash so a team keeps its colour between sessions and
 *  across devices without anything being stored. */
const TONES = [
  { fg: 'var(--ld-accent)',   bg: 'var(--ld-accent-soft)', bd: 'var(--ld-accent-line)' },
  { fg: 'var(--ld-teal)',     bg: 'var(--ld-teal-soft)',   bd: 'var(--ld-teal-line)'   },
  { fg: 'var(--ld-amber)',    bg: 'var(--ld-amber-soft)',  bd: 'var(--ld-amber-line)'  },
  { fg: 'var(--ld-rose)',     bg: 'var(--ld-rose-soft)',   bd: 'var(--ld-rose-line)'   },
  { fg: 'var(--ld-accent-2)', bg: 'var(--ld-accent-soft)', bd: 'var(--ld-accent-line)' },
];

function toneOf(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length]!;
}

/** Up to two initials — "Platform team" → PT, "Acme" → AC. */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '—';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function Badge({ name, personal, size = 'md' }: { name: string; personal?: boolean; size?: 'sm' | 'md' }) {
  const tone = toneOf(name);
  const box = size === 'md' ? 'w-[30px] h-[30px] text-[11px] rounded-[9px]' : 'w-[26px] h-[26px] text-[10px] rounded-[8px]';
  return (
    <span
      aria-hidden
      className={`${box} shrink-0 grid place-items-center font-mono font-bold tracking-[-0.02em] border`}
      style={personal
        ? { color: 'var(--ld-text-2)', background: 'var(--ld-surface-2)', borderColor: 'var(--ld-border-strong)' }
        : { color: tone.fg, background: tone.bg, borderColor: tone.bd }}
    >
      {personal ? 'ME' : monogram(name)}
    </span>
  );
}

export function TeamSwitcher() {
  const { teams } = useTeams();
  const { teamId, teamName, role } = useTeamStore();
  const enterTeam = useEnterTeam();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // `mousedown`, not `click`: a click listener added during a click sees the very event
    // that opened the menu and closes it again on the same press.
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Nothing to switch between and nothing to explain: a person who has never been in a
  // team should not be asked to think about which account they are in.
  if (teams.length === 0) return null;

  const active = teams.find(t => t.id === teamId) ?? null;
  const label  = active ? active.name : teamName && teamId ? teamName : 'Personal';
  const isTeam = !!teamId;
  const sub = active
    ? `${active.members} member${active.members === 1 ? '' : 's'} · ${active.role}`
    : isTeam
      ? (role ?? 'member')
      : 'Only you';

  function choose(team: TeamSummary | null) {
    enterTeam(team);
    setOpen(false);
  }

  return (
    <div ref={wrap} className="relative px-1 pb-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Workspace: ${label}. Switch workspace`}
        className={`w-full flex items-center gap-[10px] px-[9px] py-[8px] rounded-[12px] text-left
                    border bg-ld-surface transition-colors duration-150
                    ${open ? 'border-ld-accent-line bg-ld-surface-hover' : 'border-ld-border hover:border-ld-border-strong hover:bg-ld-surface-hover'}`}
      >
        <Badge name={label} personal={!isTeam} />

        <span className="flex-1 min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-ld-text leading-tight">{label}</span>
          <span className="block truncate font-mono text-[10.5px] text-ld-text-3 mt-[2px]">{sub}</span>
        </span>

        {/* A viewer cannot change anything in this account, which is worth saying where the
            account is named rather than at the first refused click. */}
        {isTeam && role === 'viewer' && (
          <span className="inline-flex items-center gap-[3px] text-[10px] font-semibold px-[6px] py-[2px] rounded-full border border-ld-border text-ld-text-3 shrink-0">
            <Eye className="w-[10px] h-[10px]" /> view
          </span>
        )}

        <ChevronsUpDown className="w-[13px] h-[13px] text-ld-text-3 shrink-0" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Switch workspace"
          // Wider than the sidebar lane it drops out of: team names and "4 members · owner"
          // were both truncating inside a 200px column.
          className="absolute left-1 z-30 mt-[6px] w-[248px] max-w-[calc(100vw-32px)] p-[5px]
                     rounded-[14px] border border-ld-border bg-ld-surface shadow-[0_24px_60px_-24px_rgba(0,0,0,0.75)]"
        >
          <p className="px-[9px] pt-[6px] pb-[4px] font-mono text-[9.5px] uppercase tracking-[.16em] text-ld-text-3">
            Your account
          </p>
          <Row
            label="Personal"
            hint="Only you"
            personal
            active={!teamId}
            onSelect={() => choose(null)}
          />

          <p className="px-[9px] pt-[8px] pb-[4px] font-mono text-[9.5px] uppercase tracking-[.16em] text-ld-text-3">
            Teams · {teams.length}
          </p>
          {teams.map(team => (
            <Row
              key={team.id}
              label={team.name}
              hint={`${team.members} member${team.members === 1 ? '' : 's'}`}
              role={team.role}
              active={team.id === teamId}
              onSelect={() => choose(team)}
            />
          ))}

          <Link
            to="/team"
            onClick={() => setOpen(false)}
            className="flex items-center gap-[8px] px-[9px] py-[8px] mt-[5px] rounded-[9px] border-t border-ld-border
                       text-[11.5px] text-ld-text-3 hover:text-ld-accent hover:bg-ld-surface-hover transition-colors"
          >
            <Settings2 className="w-[13px] h-[13px]" />
            Manage teams
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ label, hint, role, personal, active, onSelect }: {
  label: string;
  hint: string;
  role?: string;
  personal?: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onSelect}
      className={`w-full flex items-center gap-[10px] px-[9px] py-[7px] rounded-[10px] text-left transition-colors
                  ${active ? 'bg-ld-accent-wash' : 'hover:bg-ld-surface-hover'}`}
    >
      <Badge name={label} personal={personal} size="sm" />
      <span className="flex-1 min-w-0">
        <span className="block truncate text-[12.5px] font-semibold text-ld-text leading-tight">{label}</span>
        <span className="block truncate font-mono text-[10.5px] text-ld-text-3 mt-[2px]">
          {hint}{role ? ` · ${role}` : ''}
        </span>
      </span>
      {active && <Check className="w-[13px] h-[13px] text-ld-accent shrink-0" />}
    </button>
  );
}
