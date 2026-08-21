import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/shared/api/client';
import type {
  ProjectAuditEntry,
  RouteGroup,
  ProjectAuditsResult as ProjectAuditsData,
} from '@/entities/history';

export type { ProjectAuditEntry, RouteGroup, ProjectAuditsData };

export function useProjectAudits(projectId: string) {
  return useQuery<ProjectAuditsData>({
    queryKey: ['project-audits', projectId],
    queryFn:  () => fetchJson<ProjectAuditsData>(`/projects/${projectId}/audits`),
    enabled: !!projectId,
  });
}
