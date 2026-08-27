import { Segmented } from '@/shared/ui/segmented';
import type { AuditPrecision } from '@perfscope/shared';
import { PRECISION_MODES } from '../auditModes';

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
