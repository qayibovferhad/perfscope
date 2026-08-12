/**
 * A headline number with its label and an icon tile.
 *
 * Shared rather than owned by one feature: the project detail strip and the dashboard
 * strip are the same object, and a second copy would drift in padding and type scale
 * the first time either was touched.
 */
export function StatCard({
  label, value, icon, sub, tone = 'default', compact = false,
}: {
  label: string;
  value: string | number;
  /** Omit for the dense in-panel tiles that have no room for a tile glyph. */
  icon?: React.ReactNode;
  /** One extra qualifying line under the label ("p75 · 512 samples"). */
  sub?: React.ReactNode;
  tone?: 'default' | 'danger';
  compact?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-[14px] px-[20px] py-[18px] rounded-[16px] border border-ld-border bg-ld-surface transition-[border-color,transform] duration-[250ms] hover:border-ld-accent-line hover:-translate-y-[2px]"
    >
      {icon && (
        <div className="w-[42px] h-[42px] rounded-[12px] shrink-0 grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent">
          {icon}
        </div>
      )}
      <div>
        <b
          className={`font-mono font-semibold tracking-[-0.02em] block leading-none whitespace-nowrap ${compact ? 'text-[18px]' : 'text-[24px]'} ${tone === 'danger' ? 'text-ld-rose' : ''}`}
        >
          {value}
        </b>
        <span className="text-[12.5px] text-ld-text-3 mt-[6px] block">{label}</span>
        {sub && <span className="text-[11px] text-ld-text-3 mt-[2px] block">{sub}</span>}
      </div>
    </div>
  );
}
