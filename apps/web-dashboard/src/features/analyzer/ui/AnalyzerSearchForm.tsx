import { motion, AnimatePresence } from 'framer-motion';
import { Search, Lock, ShieldCheck, ShieldAlert, Globe } from 'lucide-react';
import type { SessionState } from '@/entities/website';
import { Segmented } from '@/shared/ui/segmented';
import { DEVICE_MODES } from '@/entities/analysis/ui/FormFactorToggle';
import { PrecisionToggle } from '@/entities/analysis/ui/PrecisionToggle';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { ProgressStepper } from '@/entities/analysis';
import type { AnalysisProgress, AuditFormFactor, AuditPrecision } from '@/entities/analysis';

interface Props {
  url:           string;
  setUrl:        (v: string) => void;
  isPending:     boolean;
  authSessionId: string | null;
  sessionStatus: SessionState;
  progress:      AnalysisProgress | null;
  formFactor:    AuditFormFactor;
  onFormFactor:  (f: AuditFormFactor) => void;
  precision:     AuditPrecision;
  onPrecision:   (p: AuditPrecision) => void;
  onSubmit:      (e: React.FormEvent) => void;
  /** Opens the login-capture flow. Shown on the expired badge, which is otherwise a
   *  dead end: the session cannot be repaired from anywhere else on this page. */
  onFixSession:  () => void;
}

export function AnalyzerSearchForm({
  url, setUrl, isPending, authSessionId, sessionStatus, progress,
  formFactor, onFormFactor, precision, onPrecision, onSubmit, onFixSession,
}: Props) {
  return (
    <div className="rounded-[18px] border border-ld-border-strong bg-ld-surface shadow-ld-shadow-card p-[22px]">

      {/* Header row */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-[16px] font-bold text-ld-text">Enter a URL to analyze</h2>
        <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={onFixSession}
              disabled={isPending}
              title="The saved login session no longer works — log in again to refresh it"
              className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold text-ld-rose px-[11px] py-[5px]
                         rounded-full border border-[rgba(242,100,122,0.3)] bg-[rgba(242,100,122,0.08)]
                         transition-colors duration-150 hover:bg-[rgba(242,100,122,0.16)] disabled:opacity-50"
            >
              <ShieldAlert className="w-[13px] h-[13px]" />
              Session expired · Fix
            </button>
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
      <form onSubmit={onSubmit} className="flex gap-[10px]">
        <Input
          icon={<Globe />}
          mono
          type="text"
          placeholder="https://example.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={isPending}
          spellCheck={false}
          wrapperClassName="flex-1"
          className="py-[14px] text-[15px]"
        />
        <Button
          type="submit"
          disabled={isPending || !url.trim()}
          className="h-auto py-[14px] px-[22px] [&_svg]:w-[16px] [&_svg]:h-[16px]"
        >
          {authSessionId ? <Lock /> : <Search />}
          {isPending ? 'Analyzing…' : 'Analyze'}
        </Button>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
