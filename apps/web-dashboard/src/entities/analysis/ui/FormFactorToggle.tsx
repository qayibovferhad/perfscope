import { Monitor, Smartphone } from 'lucide-react';
import type { AuditFormFactor } from '@perfscope/shared';
import { Segmented, type SegmentOption } from '@/shared/ui/segmented';

/** One definition of the device choice, so the analyzer and compare offer the same audit. */
export const DEVICE_MODES: SegmentOption<AuditFormFactor>[] = [
  { value: 'desktop', label: 'Desktop', icon: Monitor,    title: 'Audit as a desktop browser' },
  { value: 'mobile',  label: 'Mobile',  icon: Smartphone, title: 'Emulate a phone (412×823) — what Google ranks on' },
];

interface Props {
  value:     AuditFormFactor;
  onChange:  (v: AuditFormFactor) => void;
  disabled?: boolean;
  className?: string;
}

export function FormFactorToggle({ value, onChange, disabled, className }: Props) {
  return (
    <Segmented
      options={DEVICE_MODES}
      value={value}
      onChange={onChange}
      {...(disabled !== undefined ? { disabled } : {})}
      {...(className !== undefined ? { className } : {})}
      ariaLabel="Device profile"
    />
  );
}
