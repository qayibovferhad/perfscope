/**
 * The wordmark and tile, once. The header and the footer both drew it, each with its
 * own copy of the path and the gradient — the two had already drifted in letter spacing.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[10px] font-bold text-[17px] tracking-[-0.02em] text-ld-text ${className ?? ''}`}>
      <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center shrink-0 bg-ld-grad shadow-ld-glow">
        <svg viewBox="0 0 24 24" fill="none" className="w-[17px] h-[17px]" aria-hidden>
          <path d="M3 12h3l2.5-7 4 14 3-9 2 2H21" stroke="#04130d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>Perf<b className="text-ld-accent-2 font-extrabold">Scope</b></span>
    </span>
  );
}
