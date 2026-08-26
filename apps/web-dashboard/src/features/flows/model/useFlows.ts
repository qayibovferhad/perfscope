import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlowDefinition, FlowRunResult } from '@perfscope/shared';
import { apiClient, fetchJson } from '@/shared/api/client';
import { toast } from '@/shared/ui/toast';

const KEY = ['flows'];

/** What a write said when it failed — the server's own sentence, not axios's status line.
 *  A flow's errors are specific ("Step 2: click needs a CSS selector") and worth repeating. */
function reason(err: unknown): string | undefined {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' && data.error.trim() ? data.error : undefined;
}

export type FlowInput = Pick<FlowDefinition, 'name' | 'url' | 'steps' | 'snapshotAtEnd' | 'formFactor' | 'websiteId'>;

export function useFlows() {
  const qc = useQueryClient();

  const query = useQuery<FlowDefinition[]>({
    queryKey: KEY,
    queryFn: () => fetchJson<FlowDefinition[]>('/flows'),
  });

  const create = useMutation({
    mutationFn: (input: FlowInput) => apiClient.post<FlowDefinition>('/flows', input).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
    onError: (err) => toast.error('Could not save the flow', { description: reason(err) }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: FlowInput & { id: string }) =>
      apiClient.put<FlowDefinition>(`/flows/${id}`, input).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); },
    onError: (err) => toast.error('Could not save the flow', { description: reason(err) }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/flows/${id}`),
    // A deleted flow takes its runs with it, and nothing else on screen says so — this is
    // the one write here with no visible result but a row disappearing.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Flow deleted');
    },
    onError: (err) => toast.error('Could not delete the flow', { description: reason(err) }),
  });

  return {
    flows: query.data ?? [],
    isPending: query.isPending,
    isError: query.isError,
    create, update, remove,
  };
}

/** A flow's own history. Enabled only with an id, so the panel can mount before one is
 *  chosen without firing a request for `/flows/undefined/runs`. */
export function useFlowRuns(flowId: string | null) {
  return useQuery<FlowRunResult[]>({
    queryKey: ['flow-runs', flowId],
    queryFn: () => fetchJson<FlowRunResult[]>(`/flows/${flowId}/runs`),
    enabled: Boolean(flowId),
  });
}
