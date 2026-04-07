import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { AnalysisResult } from '../types';

async function analyzeUrl(url: string): Promise<AnalysisResult> {
  const { data } = await apiClient.post<{ success: boolean; data: AnalysisResult }>('/analyze', { url });
  return data.data;
}

export function useAnalysis() {
  return useMutation({ mutationFn: analyzeUrl });
}
