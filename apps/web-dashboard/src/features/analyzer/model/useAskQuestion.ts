import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';

interface AskResponse {
  answer: string;
  /** Five per audit, server-enforced — see askQuestion.service.ts. Drives when the box
   *  disables itself, so the limit is never learned only from a failed request. */
  questionsRemaining: number;
}

/**
 * One question against one audit's own evidence — see `AiService.answerQuestion` on the
 * backend. Deliberately a plain mutation with no query key: this isn't data to cache and
 * refetch, it's a single request-response pair the UI shows once and discards.
 */
export function useAskQuestion(analysisId: string) {
  return useMutation({
    mutationFn: (question: string) =>
      apiClient.post<AskResponse>(`/history/${analysisId}/ask`, { question }).then(r => r.data),
  });
}
