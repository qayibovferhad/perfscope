import { useWebsites } from '@/features/dashboard/hooks/useWebsites';

export function useAutomation(siteId: string) {
  const { setAutomation, triggerRun } = useWebsites();

  return {
    toggle:    (enabled: boolean)   => setAutomation.mutate({ id: siteId, enabled }),
    setRoutes: (routes: string[])   => setAutomation.mutate({ id: siteId, routes }),
    setTime:   (scheduleTime: string) => setAutomation.mutate({ id: siteId, scheduleTime }),
    save:      (patch: { routes: string[]; enabled: boolean; scheduleTime: string }) =>
                 setAutomation.mutateAsync({ id: siteId, ...patch }),
    runNow:    () => triggerRun.mutate(siteId),
    isSaving:  setAutomation.isPending,
    isRunning: triggerRun.isPending,
  };
}
