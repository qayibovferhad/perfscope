import type { AiAdviceAction } from '@perfscope/shared';

/**
 * Where an advised action goes, and what the link should say.
 *
 * The mapping lives here rather than in the panel because two components render steps and
 * both need it, and because the routes it depends on are the sort of thing that gets
 * renamed — one place to fix when `/app?url=` becomes something else.
 */
export function actionLink(action: AiAdviceAction): { to: string; label: string } {
  const url = encodeURIComponent(action.url);

  switch (action.kind) {
    case 'audit':
      return { to: `/app?url=${url}`, label: 'Audit now' };
    case 'compare':
      return { to: `/compare?url=${url}`, label: 'Compare' };
    case 'schedule':
      return { to: '/automation', label: 'Set a schedule' };
    case 'budgets':
      // Targets are edited on the site's own page now, and the alert channels that go with
      // them live with the schedule — so this points at the schedule, not the site list.
      return { to: '/automation', label: 'Set alerts' };
  }
}
