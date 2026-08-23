import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinAnalysis } from '@/entities/analysis';
import { useAnalysisStore } from '@/features/analyzer';
import { getHostname } from '@/entities/website';
import { toast } from '@/shared/ui/toast';
import type { AnalysisResult } from '@/entities/analysis';

/** The analyzer's own route — a run finishing while it is open needs no announcement. */
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
 * Two conditions, and they are both "the reader is not looking at it": the tab is in the
 * background, or the open route is not the analyzer. Someone watching the scores appear in
 * front of them gets nothing, because a notification for something already on screen is
 * how people learn to ignore notifications.
 *
 * The result is written into the analyzer's store on the way past, so "View report" lands
 * on the report itself rather than on an empty form — nothing else would have kept it: the
 * page that would normally store it was not mounted when the audit finished.
 */
export function useFinishedAuditToast(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const onComplete = (result: AnalysisResult) => {
      const unattended =
        document.visibilityState === 'hidden' ||
        window.location.pathname !== ANALYZER_PATH;
      if (!unattended) return;

      useAnalysisStore.getState().setResult(result, result.url, null);

      toast.success(`Audit finished — performance ${result.scores.performance}`, {
        description: getHostname(result.url),
        action: { label: 'View report', onClick: () => navigate(ANALYZER_PATH) },
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
