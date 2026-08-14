import { Zap, Crosshair } from 'lucide-react';
import { Segmented, type SegmentOption } from '@/shared/ui/segmented';
import type { AuditPrecision } from '@perfscope/shared';

/** One definition of the measurement choice, so the analyzer and compare offer the same
 *  audit — a comparison run at a different precision than the analyzer's is not comparable
 *  with it, and the difference was invisible because compare had no control at all. */
export const PRECISION_MODES: SegmentOption<AuditPrecision>[] = [
  { value: 'single', label: 'Fast',    icon: Zap,       title: 'One measurement — quickest, but a single run swings by ±10 points' },
  { value: 'median', label: 'Precise', icon: Crosshair, title: 'Measure three times and report the median run — ~3× slower, far less noise' },
];

interface Props {
  value:      AuditPrecision;
  onChange:   (v: AuditPrecision) => void;
  disabled?:  boolean;
  className?: string;
}

export function PrecisionToggle({ value, onChange, disabled, className }: Props) {
  return (
    <Segmented
      options={PRECISION_MODES}
      value={value}
      onChange={onChange}
      {...(disabled !== undefined ? { disabled } : {})}
      {...(className !== undefined ? { className } : {})}
      ariaLabel="Measurement precision"
    />
  );
}
