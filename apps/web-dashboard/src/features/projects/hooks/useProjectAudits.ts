import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type {
  ProjectAuditEntry,
  RouteGroup,
  ProjectAuditsResult as ProjectAuditsData,
} from '@/entities/history';

export type { ProjectAuditEntry, RouteGroup, ProjectAuditsData };

export function useProjectAudits(projectId: string) {
  return useQuery<ProjectAuditsData>({
    queryKey: ['project-audits', projectId],
    queryFn:  async () => {
      const res = await apiClient.get<{ success: boolean; data: ProjectAuditsData }>(
        `/projects/${projectId}/audits`,
      );
      return res.data.data;
    },
    enabled: !!projectId,
  });
}

export function useInvalidateProjectAudits() {
  const qc = useQueryClient();
  return (projectId: string) => qc.invalidateQueries({ queryKey: ['project-audits', projectId] });
}
