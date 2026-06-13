interface ToggleProps {
  enabled:   boolean;
  onChange:  (enabled: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ enabled, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!enabled); } }}
      disabled={disabled}
      className={`w-[46px] h-[26px] relative shrink-0 rounded-full border transition-all duration-[250ms]
                  disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ld-accent-line
                  ${enabled ? 'bg-ld-grad border-transparent' : 'bg-ld-surface-2 border-ld-border-strong'}`}
    >
      <div
        className={`absolute top-[3px] w-5 h-5 rounded-full transition-all duration-[250ms]
                    ${enabled ? 'left-[23px] bg-ld-grad-text' : 'left-[3px] bg-ld-text-3'}`}
      />
    </button>
  );
}
