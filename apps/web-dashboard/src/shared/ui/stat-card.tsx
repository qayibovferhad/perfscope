/**
 * A headline number with its label and an icon tile.
 *
 * Shared rather than owned by one feature: the project detail strip and the dashboard
 * strip are the same object, and a second copy would drift in padding and type scale
 * the first time either was touched.
 */
export function StatCard({
  label, value, icon, sub, tone = 'default', compact = false, iconClassName, valueClassName,
}: {
  label: string;
  value: string | number;
  /** Omit for the dense in-panel tiles that have no room for a tile glyph. */
  icon?: React.ReactNode;
  /** One extra qualifying line under the label ("p75 · 512 samples"). */
  sub?: React.ReactNode;
  tone?: 'default' | 'danger';
  compact?: boolean;
  /** Tint overrides — shared/ui cannot import the entity band maps (FSD flows down),
   *  so a caller that colours by band passes BAND_TILE/BAND_TEXT classes in. */
  iconClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div
      // Tighter, and the glyph goes, on a phone: paired two across, a 42px tile plus 20px
      // of padding either side leaves the label about ninety pixels to live in.
      className="flex items-center gap-[14px] max-sm:gap-[10px] px-[20px] max-sm:px-[13px] py-[18px] max-sm:py-[14px] rounded-[16px] border border-ld-border bg-ld-surface transition-[border-color,transform] duration-[250ms] hover:border-ld-accent-line hover:-translate-y-[2px]"
    >
      {icon && (
        <div className={`w-[42px] h-[42px] max-sm:w-[34px] max-sm:h-[34px] max-sm:[&_svg]:w-4 max-sm:[&_svg]:h-4 rounded-[12px] shrink-0 grid place-items-center border ${iconClassName ?? 'bg-ld-surface-2 border-ld-border text-ld-accent'}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <b
          className={`font-mono font-semibold tracking-[-0.02em] block leading-none whitespace-nowrap ${compact ? 'text-[18px]' : 'text-[24px]'} ${valueClassName ?? (tone === 'danger' ? 'text-ld-rose' : '')}`}
        >
          {value}
        </b>
        <span className="text-[12.5px] max-sm:text-[11.5px] text-ld-text-3 mt-[6px] max-sm:mt-[4px] block leading-snug">{label}</span>
        {sub && <span className="text-[11px] text-ld-text-3 mt-[2px] block">{sub}</span>}
      </div>
    </div>
  );
}
