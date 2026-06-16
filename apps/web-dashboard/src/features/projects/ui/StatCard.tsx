export function StatCard({
  label, value, icon, compact = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-[14px] px-[20px] py-[18px] rounded-[16px] border border-ld-border bg-ld-surface transition-[border-color,transform] duration-[250ms] hover:border-ld-accent-line hover:-translate-y-[2px]"
    >
      <div className="w-[42px] h-[42px] rounded-[12px] shrink-0 grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent">
        {icon}
      </div>
      <div>
        <b
          className={`font-mono font-semibold tracking-[-0.02em] block leading-none whitespace-nowrap ${compact ? 'text-[18px]' : 'text-[24px]'}`}
        >
          {value}
        </b>
        <span className="text-[12.5px] text-ld-text-3 mt-[6px] block">{label}</span>
      </div>
    </div>
  );
}
