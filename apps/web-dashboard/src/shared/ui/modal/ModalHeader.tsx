interface ModalHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** `danger` tints the icon tile red — use it for destructive confirmations. */
  tone?: 'accent' | 'danger';
}

const TONE_CLS: Record<'accent' | 'danger', string> = {
  accent: 'bg-ld-grad shadow-ld-glow',
  danger: 'bg-ld-rose shadow-[0_0_28px_rgba(242,100,122,0.38)]',
};

export function ModalHeader({ icon, title, subtitle, tone = 'accent' }: ModalHeaderProps) {
  return (
    <div className="flex gap-[14px] items-start">
      <span className={`w-[46px] h-[46px] rounded-[13px] flex-shrink-0 grid place-items-center ${TONE_CLS[tone]}`}>
        {icon}
      </span>
      <div className="pt-0.5">
        <h3 className="text-[19px] font-extrabold tracking-[-0.02em] text-ld-text leading-tight">{title}</h3>
        {subtitle && <p className="text-[13.5px] text-ld-text-2 mt-[3px]">{subtitle}</p>}
      </div>
    </div>
  );
}
