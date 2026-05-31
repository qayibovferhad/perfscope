import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './select';

interface TimePickerProps {
  value: string;          // "HH:MM"
  onChange: (value: string) => void;
  className?: string;
}

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [hh, mm] = (value ?? '00:00').split(':');

  function handleHour(h: string)   { onChange(`${h}:${mm ?? '00'}`); }
  function handleMinute(m: string) { onChange(`${hh ?? '00'}:${m}`); }

  const triggerStyle = {
    background:  '#151d33',
    border:      '1px solid var(--ps-panel-border)',
    color:       'var(--ps-accent)',
    fontFamily:  'var(--ps-font-mono)',
    fontWeight:  600,
    fontSize:    '0.75rem',
  };

  const contentStyle = {
    background: '#0f1629',
    border:     '1px solid var(--ps-panel-border)',
    color:      'var(--ps-text-heading)',
    maxHeight:  220,
    minWidth:   56,
    width:      56,
    overflowY:  'auto' as const,
  };

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <Select value={hh} onValueChange={handleHour}>
        <SelectTrigger className="w-14 h-8" style={triggerStyle}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="item-aligned" style={contentStyle}>
          {HOURS.map(h => (
            <SelectItem key={h} value={h}
              className="text-xs font-mono font-semibold cursor-pointer focus:bg-indigo-500/20 focus:text-white"
              style={{ color: 'var(--ps-text-heading)' }}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-sm font-bold" style={{ color: 'var(--ps-text-muted)' }}>:</span>

      <Select value={mm} onValueChange={handleMinute}>
        <SelectTrigger className="w-14 h-8" style={triggerStyle}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="item-aligned" style={contentStyle}>
          {MINUTES.map(m => (
            <SelectItem key={m} value={m}
              className="text-xs font-mono font-semibold cursor-pointer focus:bg-indigo-500/20 focus:text-white"
              style={{ color: 'var(--ps-text-heading)' }}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
