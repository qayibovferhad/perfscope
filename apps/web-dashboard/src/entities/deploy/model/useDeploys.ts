import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getHostname, useWebsites } from '@/entities/website';
import type { DeployInput } from '@perfscope/shared';
import { createDeploy, deleteDeploy, listDeploys } from '../api/deployApi';

/** As far back as any chart in the app plots. */
const WINDOW_DAYS = 365;

/**
 * The deploys to draw beside a page's history.
 *
 * Keyed off the audited URL rather than a site id, because that is what the history views
 * actually hold — they group runs by URL, and the site record is only reachable by
 * matching hostnames. A URL with no site behind it (an ad-hoc audit of somewhere the
 * account never added) simply has no deploys, which is the honest answer.
 */
export function useDeploys(url: string | undefined) {
  const { websites } = useWebsites();
  const host = url ? getHostname(url) : '';
  const websiteId = websites.find(w => getHostname(w.url) === host)?._id;

  const query = useQuery({
    queryKey: ['deploys', websiteId],
    queryFn:  () => listDeploys(websiteId!, WINDOW_DAYS),
    enabled:  !!websiteId,
  });

  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['deploys', websiteId] });

  const mark = useMutation({
    mutationFn: (input: DeployInput) => createDeploy(websiteId!, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDeploy(id),
    onSuccess: invalidate,
  });

  return {
    deploys: query.data ?? [],
    /** Null when this URL belongs to no site of theirs — nothing can be recorded against it. */
    websiteId: websiteId ?? null,
    isLoading: query.isLoading,
    mark,
    remove,
  };
}
