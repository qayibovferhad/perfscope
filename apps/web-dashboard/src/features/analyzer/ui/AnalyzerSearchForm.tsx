import { motion, AnimatePresence } from 'framer-motion';
import { Search, Lock, ShieldCheck, ShieldAlert, Globe, Zap, Crosshair } from 'lucide-react';
import type { SessionState } from '@/entities/website';
import { Segmented, type SegmentOption } from '@/shared/ui/segmented';
import { DEVICE_MODES } from '@/entities/analysis/ui/FormFactorToggle';
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
}

const PRECISION_MODES: SegmentOption<AuditPrecision>[] = [
  { value: 'single', label: 'Fast',    icon: Zap,       title: 'One measurement — quickest, but a single run swings by ±10 points' },
  { value: 'median', label: 'Precise', icon: Crosshair, title: 'Measure three times and report the median run — ~3× slower, far less noise' },
];

export function AnalyzerSearchForm({
  url, setUrl, isPending, authSessionId, sessionStatus, progress,
  formFactor, onFormFactor, precision, onPrecision, onSubmit,
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
          {/* The stored session is dead: this run would land on the login page again. */}
          {sessionStatus === 'expired' && (
            <span
              className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold text-ld-rose px-[11px] py-[5px] rounded-full border border-[rgba(242,100,122,0.3)] bg-[rgba(242,100,122,0.08)]"
              title="The saved login session no longer works — refresh it before auditing"
            >
              <ShieldAlert className="w-[13px] h-[13px]" />
              Session expired
            </span>
          )}
          {/* Device profile + measurement precision */}
          <Segmented
            options={DEVICE_MODES}
            value={formFactor}
            onChange={onFormFactor}
            disabled={isPending}
            ariaLabel="Audit device profile"
          />
          <Segmented
            options={PRECISION_MODES}
            value={precision}
            onChange={onPrecision}
            disabled={isPending}
            ariaLabel="Measurement precision"
          />
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
