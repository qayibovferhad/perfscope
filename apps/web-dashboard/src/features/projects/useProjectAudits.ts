import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export interface ProjectAuditEntry {
  id:        string;
  shortId:   string;
  url:       string;
  timestamp: string;
  routePath: string;
  scores: {
    performance:   number;
    accessibility: number;
    bestPractices: number;
    seo:           number;
  };
  metrics: {
    fcp: number;
    lcp: number;
    tbt: number;
    cls: number;
    si:  number;
    tti: number;
  };
}

export interface RouteGroup {
  routePath:  string;
  entries:    ProjectAuditEntry[];
  trend:      'improving' | 'regressing' | 'stable' | 'single';
  lastScore:  number;
}

export interface ProjectAuditsData {
  project: { id: string; name: string; url: string };
  groups:  RouteGroup[];
  stats: {
    totalAudits:    number;
    avgPerformance: number;
    uniqueRoutes:   number;
    lastAuditAt:    string | null;
  };
}

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
