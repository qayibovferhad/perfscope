import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './select';

interface TimePickerProps {
  value:     string;
  onChange:  (value: string) => void;
  className?: string;
}

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [hh, mm] = (value ?? '00:00').split(':');

  const handleHour   = (h: string) => onChange(`${h}:${mm ?? '00'}`);
  const handleMinute = (m: string) => onChange(`${hh ?? '00'}:${m}`);

  const triggerCls = 'w-[68px] h-9 font-mono text-[18px] font-semibold text-ld-accent-2 bg-ld-bg-2 border-ld-border-strong rounded-[10px]';
  const contentCls = 'bg-ld-bg-2 border-ld-border min-w-[68px] w-[68px] max-h-[220px] overflow-y-auto';

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Select value={hh} onValueChange={handleHour}>
        <SelectTrigger className={triggerCls}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="item-aligned" className={contentCls}>
          {HOURS.map(h => (
            <SelectItem key={h} value={h}
              className="text-xs font-mono font-semibold cursor-pointer text-ld-text focus:bg-ld-accent-soft focus:text-ld-accent">
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="font-mono text-[20px] font-bold text-ld-text-3">:</span>

      <Select value={mm} onValueChange={handleMinute}>
        <SelectTrigger className={triggerCls}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="item-aligned" className={contentCls}>
          {MINUTES.map(m => (
            <SelectItem key={m} value={m}
              className="text-xs font-mono font-semibold cursor-pointer text-ld-text focus:bg-ld-accent-soft focus:text-ld-accent">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
