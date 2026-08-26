import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TeamDetail, TeamInviteInfo, TeamInvitePreview, TeamRole, TeamSummary } from '@perfscope/shared';
import { apiClient, fetchJson } from '@/shared/api/client';
import { resetSocket } from '@/shared/api/socket';
import { useTeamStore } from '@/shared/model/teamStore';
import { toast } from '@/shared/ui/toast';

const KEY = ['teams'];

function reason(err: unknown): string | undefined {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' && data.error.trim() ? data.error : undefined;
}

/** The teams this account can enter. Every page's data depends on which one is active, so
 *  this list is the one query that must never be scoped by the active team itself — it
 *  isn't: the server answers it from the caller's identity, not from the header. */
export function useTeams() {
  const query = useQuery<TeamSummary[]>({
    queryKey: KEY,
    queryFn:  () => fetchJson<TeamSummary[]>('/teams'),
  });
  return { teams: query.data ?? [], isPending: query.isPending, isError: query.isError };
}

/**
 * Switching accounts.
 *
 * Three things move together and all three have to: the header every request carries, the
 * socket handshake (which cannot be changed on a live connection — it is rebuilt), and the
 * query cache, which is full of the previous account's sites, audits and flows. Leaving any
 * one behind shows one account's data under another's name.
 */
export function useEnterTeam() {
  const qc    = useQueryClient();
  const enter = useTeamStore(s => s.enter);

  return (team: TeamSummary | null) => {
    enter(team);
    resetSocket();
    qc.clear();
  };
}

export function useTeam(id: string | null) {
  return useQuery<TeamDetail>({
    queryKey: [...KEY, id],
    queryFn:  () => fetchJson<TeamDetail>(`/teams/${id}`),
    enabled:  !!id,
  });
}

export function useTeamInvites(id: string | null, enabled: boolean) {
  return useQuery<TeamInviteInfo[]>({
    queryKey: [...KEY, id, 'invites'],
    queryFn:  () => fetchJson<TeamInviteInfo[]>(`/teams/${id}/invites`),
    enabled:  !!id && enabled,
  });
}

/** Everything an owner does to a team, and the one thing a member does (leave). */
export function useTeamActions(teamId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => { qc.invalidateQueries({ queryKey: KEY }); };

  const create = useMutation({
    mutationFn: (name: string) => apiClient.post<TeamDetail>('/teams', { name }).then(r => r.data),
    onSuccess: invalidate,
    onError: (err) => toast.error('Could not create the team', { description: reason(err) }),
  });

  const rename = useMutation({
    mutationFn: (name: string) => apiClient.patch<TeamDetail>(`/teams/${teamId}`, { name }).then(r => r.data),
    onSuccess: invalidate,
    onError: (err) => toast.error('Could not rename the team', { description: reason(err) }),
  });

  const remove = useMutation({
    mutationFn: () => apiClient.delete(`/teams/${teamId}`),
    onSuccess: () => { invalidate(); toast.success('Team deleted', { description: 'Its audits, sites and flows are untouched — they were always yours.' }); },
    onError: (err) => toast.error('Could not delete the team', { description: reason(err) }),
  });

  const invite = useMutation({
    mutationFn: (role: TeamRole) => apiClient.post<TeamInviteInfo>(`/teams/${teamId}/invites`, { role }).then(r => r.data),
    onSuccess: invalidate,
    onError: (err) => toast.error('Could not create an invite', { description: reason(err) }),
  });

  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => apiClient.delete(`/teams/${teamId}/invites/${inviteId}`),
    onSuccess: () => { invalidate(); toast.success('Invitation revoked'); },
    onError: (err) => toast.error('Could not revoke it', { description: reason(err) }),
  });

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) =>
      apiClient.patch<TeamDetail>(`/teams/${teamId}/members/${userId}`, { role }).then(r => r.data),
    onSuccess: invalidate,
    onError: (err) => toast.error('Could not change that role', { description: reason(err) }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/teams/${teamId}/members/${userId}`),
    onSuccess: invalidate,
    onError: (err) => toast.error('Could not remove them', { description: reason(err) }),
  });

  return { create, rename, remove, invite, revokeInvite, setRole, removeMember };
}

export function useInvitePreview(token: string) {
  return useQuery<TeamInvitePreview>({
    queryKey: ['invite', token],
    queryFn:  () => fetchJson<TeamInvitePreview>(`/invites/${token}`),
    // An invitation is read once; re-checking it while somebody reads the page would only
    // let it turn invalid under them.
    retry: false,
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => apiClient.post<TeamDetail>(`/invites/${token}/accept`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
    onError: (err) => toast.error('Could not join the team', { description: reason(err) }),
  });
}
