interface ModalHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function ModalHeader({ icon, title, subtitle }: ModalHeaderProps) {
  return (
    <div className="flex gap-[14px] items-start">
      <span className="w-[46px] h-[46px] rounded-[13px] flex-shrink-0 grid place-items-center bg-ld-grad shadow-ld-glow">
        {icon}
      </span>
      <div className="pt-0.5">
        <h3 className="text-[19px] font-extrabold tracking-[-0.02em] text-ld-text leading-tight">{title}</h3>
        {subtitle && <p className="text-[13.5px] text-ld-text-2 mt-[3px]">{subtitle}</p>}
      </div>
    </div>
  );
}
