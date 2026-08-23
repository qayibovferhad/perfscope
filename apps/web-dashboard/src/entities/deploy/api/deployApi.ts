import { apiClient, fetchJson } from '@/shared/api/client';
import type { Deploy, DeployInput } from '@perfscope/shared';

export const listDeploys = (websiteId: string, days: number) =>
  fetchJson<Deploy[]>(`/websites/${websiteId}/deploys`, { days });

export const createDeploy = async (websiteId: string, input: DeployInput) =>
  (await apiClient.post<Deploy>(`/websites/${websiteId}/deploys`, input)).data;

export const deleteDeploy = async (id: string) => {
  await apiClient.delete(`/deploys/${id}`);
};
