import type { AuditFormFactor } from '@perfscope/shared';
import { Segmented } from '@/shared/ui/segmented';
import { DEVICE_MODES } from '../auditModes';

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
