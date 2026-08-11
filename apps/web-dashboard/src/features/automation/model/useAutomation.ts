import type { AutomationScheduleMode, AutomationSlot } from '@perfscope/shared';
import { useWebsites } from '@/entities/website';

/** Everything the setup modal saves in one go. */
export interface AutomationPatch {
  routes:         string[];
  enabled:        boolean;
  scheduleTime:   string;
  scheduleMode:   AutomationScheduleMode;
  slots:          AutomationSlot[];
  spreadMinutes:  number;
}

export function useAutomation(siteId: string) {
  const { setAutomation, triggerRun } = useWebsites();

  return {
    toggle:    (enabled: boolean)     => setAutomation.mutate({ id: siteId, enabled }),
    setRoutes: (routes: string[])     => setAutomation.mutate({ id: siteId, routes }),
    setTime:   (scheduleTime: string) => setAutomation.mutate({ id: siteId, scheduleTime }),
    save:      (patch: AutomationPatch) => setAutomation.mutateAsync({ id: siteId, ...patch }),
    runNow:    () => triggerRun.mutate(siteId),
    isSaving:  setAutomation.isPending,
    isRunning: triggerRun.isPending,
  };
}
