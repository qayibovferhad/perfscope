import { motion, AnimatePresence } from 'framer-motion';
import { Search, Lock, ShieldCheck, ShieldAlert, Globe, Clock } from 'lucide-react';
import type { SessionState } from '@/entities/website';
import { Segmented } from '@/shared/ui/segmented';
import { DEVICE_MODES, PrecisionToggle, ElapsedClock } from '@/entities/analysis';
import { Button } from '@/shared/ui/button';
import { Panel } from '@/shared/ui/panel';
import { UrlCombobox, type UrlSuggestion } from '@/shared/ui/url-combobox';
import { ProgressStepper } from '@/entities/analysis';
import type { AnalysisProgress, AuditFormFactor, AuditPrecision } from '@/entities/analysis';

interface Props {
  url:           string;
  setUrl:        (v: string) => void;
  suggestions:   UrlSuggestion[];
  isPending:     boolean;
  authSessionId: string | null;
  sessionStatus: SessionState;
  progress:      AnalysisProgress | null;
  formFactor:    AuditFormFactor;
  onFormFactor:  (f: AuditFormFactor) => void;
  precision:     AuditPrecision;
  onPrecision:   (p: AuditPrecision) => void;
  onSubmit:      (e: React.FormEvent) => void;
  /** When the run in flight began, for the elapsed clock. Null when the run was adopted
   *  from an earlier page load and its true start time is unknown. */
  startedAt:     number | null;
  /** Abandons the run in flight. Absent for callers with nothing to cancel. */
  onCancel?:     () => void;
  /** Opens the login-capture flow. Shown on the expired badge, which is otherwise a
   *  dead end: the session cannot be repaired from anywhere else on this page. */
  onFixSession:  () => void;
}

export function AnalyzerSearchForm({
  url, setUrl, suggestions, isPending, authSessionId, sessionStatus, progress,
  formFactor, onFormFactor, precision, onPrecision, onSubmit, onFixSession,
  startedAt, onCancel,
}: Props) {
  return (
    <Panel border="strong" className="shadow-ld-shadow-card p-[22px]">

      {/* Header row */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-[16px] font-bold text-ld-text">Enter a URL to analyze</h2>
        {/* Wraps, and each control keeps its own line rather than being clipped by the
            panel: at 390px the device and precision toggles together are wider than the
            card, and "Precise" was disappearing off the edge of it. */}
        <div className="flex items-center gap-2 flex-wrap max-w-full">
          {sessionStatus === 'active' && (
            <span className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold text-ld-accent px-[11px] py-[5px] rounded-full border border-ld-accent-line bg-ld-accent-soft">
              <ShieldCheck className="w-[13px] h-[13px]" />
              Session active
            </span>
          )}
          {/* The stored session is dead: this run would land on the login page again.
              A button, not a label — naming the problem while leaving the user to find the
              repair themselves is the whole complaint. It opens the capture flow. */}
          {sessionStatus === 'expired' && (
            <Button
              type="button"
              variant="destructive-soft"
              size="sm"
              className="rounded-full"
              onClick={onFixSession}
              disabled={isPending}
              title="The saved login session no longer works — log in again to refresh it"
            >
              <ShieldAlert className="w-[13px] h-[13px]" />
              Session expired · Fix
            </Button>
          )}
          {/* Device profile + measurement precision */}
          <Segmented
            options={DEVICE_MODES}
            value={formFactor}
            onChange={onFormFactor}
            disabled={isPending}
            ariaLabel="Audit device profile"
          />
          <PrecisionToggle value={precision} onChange={onPrecision} disabled={isPending} />
        </div>
      </div>

      {/* Input row */}
      {/* Stacked on a phone. Side by side, the button's text is fixed-width and the input
          gets whatever is left — which at 390px was not enough for a URL, and the button
          itself was pushed past the card edge. */}
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-[10px]">
        <UrlCombobox
          icon={<Globe />}
          mono
          placeholder="https://example.com"
          value={url}
          onChange={setUrl}
          suggestions={suggestions}
          disabled={isPending}
          className="flex-1"
          inputClassName="py-[14px] text-[15px]"
        />
        {/* One button, two jobs. While a run is in flight the primary button is dead
            weight — disabled and reading "Analyzing…" — so it becomes the way out
            instead. Red rather than the accent gradient, so the change of meaning is
            visible before the click rather than after it. */}
        {isPending && onCancel ? (
          <Button
            type="button"
            variant="destructive"
            onClick={onCancel}
            className="h-auto py-[14px] px-[22px] max-sm:w-full"
          >
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isPending || !url.trim()}
            className="h-auto py-[14px] px-[22px] max-sm:w-full [&_svg]:w-[16px] [&_svg]:h-[16px]"
          >
            {authSessionId ? <Lock /> : <Search />}
            {isPending ? 'Analyzing…' : 'Analyze'}
          </Button>
        )}
      </form>

      <AnimatePresence>
        {isPending && progress && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-5 overflow-hidden"
          >
            <ProgressStepper progress={progress} />

            {/* Lighthouse waits out its own quiet windows, so even a fast page is tens of
                seconds and a Precise run measures several times over. Saying so up front
                is what stops a working audit from reading as a hung one — and the clock
                proves it is still moving. */}
            <p className="mt-4 flex items-center gap-2 text-[12px] text-ld-text-3">
              <Clock className="w-[13px] h-[13px] shrink-0" />
              <span>
                {precision === 'median'
                  ? 'Precise mode measures the page several times — this usually takes a few minutes.'
                  : 'This usually takes under a minute; heavy pages can take a few minutes.'}
              </span>
              {startedAt !== null && (
                <ElapsedClock startedAt={startedAt} className="ml-auto font-mono tabular-nums text-ld-text-2" />
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
