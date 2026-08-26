import { useState } from 'react';
import { Check, Copy, Link2, LogOut, Plus, Shield, Trash2, User, Users } from 'lucide-react';
import type { TeamRole, TeamSummary } from '@perfscope/shared';
import { canManage } from '@perfscope/shared';
import { Page, PageHeader } from '@/shared/ui/page';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Field } from '@/shared/ui/field';
import { Segmented } from '@/shared/ui/segmented';
import { StatePanel } from '@/shared/ui/state-panel';
import { Skeleton } from '@/shared/ui/skeleton';
import { ConfirmModal } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { timeAgo } from '@/shared/lib/time';
import { useAuthStore } from '@/features/auth';
import { useTeamStore } from '@/shared/model/teamStore';
import {
  useEnterTeam, useTeam, useTeamActions, useTeamInvites, useTeams,
} from '@/features/teams';

/**
 * Teams — who else can see this account.
 *
 * The page is deliberately blunt about what a team *is*, because the model is unusual and
 * guessing it wrong is expensive: a team is people working inside **one account's** data,
 * not a shared folder things get moved into. That is why deleting a team deletes nothing,
 * and why the panel says so beside the button rather than in a tooltip.
 */
export function TeamPage() {
  const me        = useAuthStore(s => s.user);
  const { teams, isPending } = useTeams();
  const activeId  = useTeamStore(s => s.teamId);
  const enterTeam = useEnterTeam();

  // The team being administered: the active one when there is one, else the first owned.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const teamId = selectedId ?? activeId ?? teams[0]?.id ?? null;

  const { data: team } = useTeam(teamId);
  const canAdmin = team ? canManage(team.role) : false;
  const { data: invites = [] } = useTeamInvites(teamId, canAdmin);
  const actions = useTeamActions(teamId);

  const [newName,   setNewName]   = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [freshLink, setFreshLink] = useState('');
  const [leaving,   setLeaving]   = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  async function createTeam() {
    const name = newName.trim();
    if (!name) return;
    const created = await actions.create.mutateAsync(name);
    setNewName('');
    setSelectedId(created.id);
    // Straight into it: making a team and then still looking at your own data is a step
    // everybody has to undo by hand.
    enterTeam({ id: created.id, name: created.name, role: 'owner', members: 1, ownerName: '' });
  }

  async function mintInvite() {
    const invite = await actions.invite.mutateAsync(inviteRole);
    setFreshLink(invite.url ?? '');
  }

  async function copyLink() {
    await navigator.clipboard.writeText(freshLink);
    toast.success('Invite link copied', { description: 'It works once, for seven days.' });
  }

  async function leave() {
    if (!team || !me) return;
    setLeaving(false);
    await actions.removeMember.mutateAsync(me.sub);
    if (activeId === team.id) enterTeam(null);
    setSelectedId(null);
  }

  async function destroy() {
    if (!team) return;
    setDeleting(false);
    await actions.remove.mutateAsync();
    if (activeId === team.id) enterTeam(null);
    setSelectedId(null);
  }

  return (
    <Page width="narrow">
      <PageHeader
        title="Teams"
        description="Let somebody else see the sites, audits and flows in this account."
      />

      <div className="flex flex-col gap-[14px]">
        {/* ── Which team ─────────────────────────────────────────────── */}
        <Panel>
          <PanelHeader icon={<Users />} title="Your teams" meta={`${teams.length}`} />
          <PanelBody>
            {isPending ? (
              <Skeleton className="h-[64px]" />
            ) : teams.length === 0 ? (
              <p className="text-[12.5px] text-ld-text-2">
                You are not in a team yet. Create one below and send somebody the link — they
                will see this account's data, not a copy of it.
              </p>
            ) : (
              <ul className="flex flex-col gap-[6px]">
                {teams.map(row => (
                  <TeamRow
                    key={row.id}
                    team={row}
                    selected={row.id === teamId}
                    active={row.id === activeId}
                    onSelect={() => setSelectedId(row.id)}
                    onEnter={() => enterTeam(row)}
                  />
                ))}
              </ul>
            )}

            <div className="flex items-end gap-[8px] mt-[14px] pt-[14px] border-t border-ld-border">
              <Field label="New team" className="flex-1">
                {(id) => (
                  <Input
                    id={id}
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Platform team"
                    className="h-[34px] text-[13px]"
                  />
                )}
              </Field>
              <Button size="sm" onClick={createTeam} disabled={!newName.trim() || actions.create.isPending}>
                <Plus className="w-[14px] h-[14px]" /> Create
              </Button>
            </div>
          </PanelBody>
        </Panel>

        {/* ── The people in it ───────────────────────────────────────── */}
        {team && (
          <Panel>
            <PanelHeader icon={<User />} title={`${team.name} · people`} meta={`${team.members}`} />
            <PanelBody>
              <ul className="flex flex-col gap-[4px]">
                {team.memberList.map(member => (
                  <li key={member.userId} className="flex items-center gap-[10px] py-[7px] border-b border-ld-border last:border-0">
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ld-text">
                        {member.name}{member.userId === me?.sub && ' (you)'}
                      </span>
                      <span className="block truncate text-[11.5px] text-ld-text-3">
                        {member.email} · joined {timeAgo(member.joinedAt)}
                      </span>
                    </span>

                    {member.userId === team.ownerId ? (
                      <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold text-ld-accent">
                        <Shield className="w-[12px] h-[12px]" /> owner
                      </span>
                    ) : canAdmin ? (
                      <>
                        <Segmented
                          value={member.role}
                          onChange={(role) => actions.setRole.mutate({ userId: member.userId, role: role as TeamRole })}
                          options={[{ value: 'member', label: 'Member' }, { value: 'viewer', label: 'Viewer' }]}
                          ariaLabel={`Role for ${member.name}`}
                        />
                        <Button
                          variant="ghost" size="icon-xs"
                          aria-label={`Remove ${member.name}`}
                          onClick={() => actions.removeMember.mutate(member.userId)}
                        >
                          <Trash2 className="w-[14px] h-[14px]" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold text-ld-text-3">{member.role}</span>
                    )}
                  </li>
                ))}
              </ul>

              {!canAdmin && (
                <Button variant="outline" size="sm" className="mt-[12px]" onClick={() => setLeaving(true)}>
                  <LogOut className="w-[14px] h-[14px]" /> Leave this team
                </Button>
              )}
            </PanelBody>
          </Panel>
        )}

        {/* ── Invitations ────────────────────────────────────────────── */}
        {team && canAdmin && (
          <Panel>
            <PanelHeader icon={<Link2 />} title="Invitations" meta={`${invites.length} open`} />
            <PanelBody>
              <div className="flex items-end gap-[10px] flex-wrap">
                <Field label="They join as">
                  {() => (
                    <Segmented
                      value={inviteRole}
                      onChange={(role) => setInviteRole(role as TeamRole)}
                      options={[{ value: 'member', label: 'Member' }, { value: 'viewer', label: 'Viewer' }]}
                      ariaLabel="Role for the invitation"
                    />
                  )}
                </Field>
                <Button size="sm" onClick={mintInvite} disabled={actions.invite.isPending}>
                  <Link2 className="w-[14px] h-[14px]" /> Create link
                </Button>
                <p className="flex-1 min-w-[220px] text-[11.5px] text-ld-text-3 pb-[6px]">
                  A member runs audits and edits sites. A viewer can only read.
                </p>
              </div>

              {freshLink && (
                <div className="flex items-center gap-[8px] mt-[12px] p-[10px] rounded-[10px] border border-ld-accent-line bg-ld-accent-wash">
                  {/* Shown exactly once. Only the hash is stored, so nothing can hand it back. */}
                  <code className="flex-1 min-w-0 truncate font-mono text-[11.5px] text-ld-text">{freshLink}</code>
                  <Button size="sm" variant="secondary" onClick={copyLink}>
                    <Copy className="w-[13px] h-[13px]" /> Copy
                  </Button>
                </div>
              )}

              {invites.length > 0 && (
                <ul className="flex flex-col gap-[4px] mt-[12px]">
                  {invites.map(invite => (
                    <li key={invite.id} className="flex items-center gap-[10px] py-[6px] border-b border-ld-border last:border-0">
                      <span className="flex-1 text-[12px] text-ld-text-2">
                        {invite.role} · created {timeAgo(invite.createdAt)} · expires {timeAgo(invite.expiresAt)}
                      </span>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => actions.revokeInvite.mutate(invite.id)}
                      >
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        )}

        {/* ── Deleting one ───────────────────────────────────────────── */}
        {team && canAdmin && (
          <Panel>
            <PanelHeader icon={<Trash2 />} title="Delete this team" />
            <PanelBody>
              <p className="text-[12.5px] text-ld-text-2">
                Deleting <b>{team.name}</b> removes everyone else's access to this account. Your
                sites, audits, flows and history are untouched — they were never the team's, they
                have always been yours.
              </p>
              <Button variant="destructive" size="sm" className="mt-[12px]" onClick={() => setDeleting(true)}>
                <Trash2 className="w-[14px] h-[14px]" /> Delete team
              </Button>
            </PanelBody>
          </Panel>
        )}

        {teams.length > 0 && !team && (
          <StatePanel
            variant="empty"
            icon={<Users className="w-6 h-6" />}
            title="Pick a team"
            description="Choose one above to see its people and invitations."
          />
        )}
      </div>

      <ConfirmModal
        open={leaving}
        onClose={() => setLeaving(false)}
        onConfirm={leave}
        title="Leave this team?"
        subtitle="You will lose access to this account's data. The owner can invite you again."
        confirmLabel="Leave"
      />
      <ConfirmModal
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={destroy}
        title={`Delete ${team?.name ?? 'this team'}?`}
        subtitle="Everyone else loses access. Nothing you have measured is deleted."
        confirmLabel="Delete team"
      />
    </Page>
  );
}

function TeamRow({ team, selected, active, onSelect, onEnter }: {
  team: TeamSummary; selected: boolean; active: boolean; onSelect: () => void; onEnter: () => void;
}) {
  return (
    <li>
      <div
        className={`flex items-center gap-[10px] px-[10px] py-[8px] rounded-[10px] border transition-colors
                    ${selected ? 'border-ld-accent-line bg-ld-accent-wash' : 'border-ld-border bg-ld-surface'}`}
      >
        <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-left">
          <span className="block truncate text-[13px] font-semibold text-ld-text">{team.name}</span>
          <span className="block truncate text-[11.5px] text-ld-text-3">
            {team.members} member{team.members === 1 ? '' : 's'} · you are {team.role} · owned by {team.ownerName || 'you'}
          </span>
        </button>
        {active ? (
          <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold text-ld-accent">
            <Check className="w-[12px] h-[12px]" /> viewing
          </span>
        ) : (
          <Button variant="outline" size="sm" onClick={onEnter}>Switch to</Button>
        )}
      </div>
    </li>
  );
}
