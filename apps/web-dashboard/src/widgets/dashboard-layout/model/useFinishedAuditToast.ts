import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinAnalysis, useRunningAuditsStore } from '@/entities/analysis';
import { useAnalysisStore } from '@/features/analyzer';
import { getHostname } from '@/entities/website';
import { toast } from '@/shared/ui/toast';
import { isResultRoute } from './resultRoutes';
import type { AnalysisResult } from '@/entities/analysis';

/** Where "open the report" sends the reader. */
const ANALYZER_PATH = '/app';

/**
 * Say so when an audit finishes that nobody was watching.
 *
 * This has to live in the shell rather than in `useAnalysis`, and the reason is the whole
 * point of it: the moment someone leaves the analyzer, that hook's listeners are detached,
 * so the one case worth announcing — the run that finished while they were somewhere else —
 * is precisely the case a listener there cannot see. The sidebar is mounted for as long as
 * the app is.
 *
 * One condition: the open route is not one that shows results (see `resultRoutes`).
 * Someone on the analyzer or the compare page gets nothing — no toast and no sidebar card —
 * because a notification for something already on screen is how people learn to ignore
 * notifications. That covers a backgrounded tab too: whenever they come back to it, the
 * report is what they are looking at, so there is nothing left to announce.
 *
 * The result is written into the analyzer's store on the way past, so opening it lands on
 * the report itself rather than on an empty form — nothing else would have kept it: the
 * page that would normally store it was not mounted when the audit finished.
 *
 * It does not time out. A finished audit is not a confirmation of something the reader just
 * did, it is a *result waiting to be read*, and a result that removes itself after four
 * seconds while they are looking at another page is a result they never had. It stays as a
 * card until it is opened or dismissed, and the whole card is the target.
 */
export function useFinishedAuditToast(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const onComplete = (result: AnalysisResult) => {
      if (isResultRoute(window.location.pathname)) return;

      useAnalysisStore.getState().setResult(result, result.url, null);
      // Also parked in the shell, above Add Website: the toast is where the reader was
      // looking when it landed, the sidebar is where they come back to afterwards.
      useRunningAuditsStore.getState().finish(result.url, result.scores.performance);

      toast.success(`Audit finished — performance ${result.scores.performance}`, {
        description: `${getHostname(result.url)} · open the report`,
        duration: Infinity,
        onClick: () => navigate(ANALYZER_PATH),
      });
    };

    // `joinAnalysis` attaches to the shared socket without starting anything; the other
    // callbacks are required by the shape and deliberately do nothing here.
    return joinAnalysis({
      onProgress: () => {},
      onPartial:  () => {},
      onComplete,
      onError:    () => {},
    });
    // Attached once, not per route: the handler reads `window.location` when the audit
    // lands, so it already sees the current route, and re-attaching on every navigation
    // would open a gap exactly where someone is moving between pages.
  }, [navigate]);
}
