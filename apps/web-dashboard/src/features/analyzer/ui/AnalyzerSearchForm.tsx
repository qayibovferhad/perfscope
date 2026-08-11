import { motion, AnimatePresence } from 'framer-motion';
import { Search, Lock, ShieldCheck, Globe, Monitor, Smartphone, Zap, Crosshair } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { ProgressStepper } from '@/entities/analysis';
import type { AnalysisProgress, AuditFormFactor, AuditPrecision } from '@/entities/analysis';

interface Props {
  url:           string;
  setUrl:        (v: string) => void;
  isPending:     boolean;
  authSessionId: string | null;
  hasSession:    boolean;
  progress:      AnalysisProgress | null;
  formFactor:    AuditFormFactor;
  onFormFactor:  (f: AuditFormFactor) => void;
  precision:     AuditPrecision;
  onPrecision:   (p: AuditPrecision) => void;
  onSubmit:      (e: React.FormEvent) => void;
}

interface SegmentOption<T> {
  value: T;
  label: string;
  icon:  typeof Monitor;
  title: string;
}

function Segmented<T extends string>({
  options, value, onChange, disabled, ariaLabel,
}: {
  options:  SegmentOption<T>[];
  value:    T;
  onChange: (v: T) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <div
      className="inline-flex rounded-[10px] border border-ld-border-strong bg-ld-surface-2 p-[3px]"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map(({ value: v, label, icon: Icon, title }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            title={title}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`inline-flex items-center gap-[6px] text-[12px] font-semibold px-[11px] py-[6px] rounded-[8px] transition-all duration-150 disabled:opacity-50 ${
              active
                ? 'bg-ld-accent-soft text-ld-accent-2 [box-shadow:inset_0_0_0_1px_var(--ld-accent-line)]'
                : 'text-ld-text-3 hover:text-ld-text-2'
            }`}
          >
            <Icon className="w-[13px] h-[13px]" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

const DEVICE_MODES: SegmentOption<AuditFormFactor>[] = [
  { value: 'desktop', label: 'Desktop', icon: Monitor,    title: 'Audit as a desktop browser' },
  { value: 'mobile',  label: 'Mobile',  icon: Smartphone, title: 'Emulate a phone (412×823) — what Google ranks on' },
];

const PRECISION_MODES: SegmentOption<AuditPrecision>[] = [
  { value: 'single', label: 'Fast',    icon: Zap,       title: 'One measurement — quickest, but a single run swings by ±10 points' },
  { value: 'median', label: 'Precise', icon: Crosshair, title: 'Measure three times and report the median run — ~3× slower, far less noise' },
];

export function AnalyzerSearchForm({
  url, setUrl, isPending, authSessionId, hasSession, progress,
  formFactor, onFormFactor, precision, onPrecision, onSubmit,
}: Props) {
  return (
    <div className="rounded-[18px] border border-ld-border-strong bg-ld-surface shadow-ld-shadow-card p-[22px]">

      {/* Header row */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-[16px] font-bold text-ld-text">Enter a URL to analyze</h2>
        <div className="flex items-center gap-2">
          {hasSession && (
            <span className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold text-ld-accent px-[11px] py-[5px] rounded-full border border-ld-accent-line bg-ld-accent-soft">
              <ShieldCheck className="w-[13px] h-[13px]" />
              Session active
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
