import { useNavigate } from 'react-router-dom';
import { usePrefetchStore } from '@/entities/analysis';

export function useWebsiteActions() {
  const navigate = useNavigate();

  function quickAudit(url: string, id: string) {
    usePrefetchStore.getState().start(url);
    navigate(`/app?url=${encodeURIComponent(url)}&projectId=${id}`);
  }

  function startAudit(url: string, id: string) {
    navigate(`/app?prefill=${encodeURIComponent(url)}&projectId=${id}`);
  }

  function startCompare(url: string) {
    navigate(`/compare?url=${encodeURIComponent(url)}`);
  }

  return { quickAudit, startAudit, startCompare };
}
