import type { FEATURES } from '../config';

export function FeatureCard({ Icon, title, desc }: typeof FEATURES[number]) {
  return (
    <div className="group relative overflow-hidden rounded-[16px] border border-ld-border bg-ld-surface p-[22px]
                    transition-[border-color,transform,box-shadow] duration-[250ms]
                    hover:border-ld-accent-line hover:-translate-y-[3px]
                    hover:shadow-[0_0_0_1px_var(--ld-accent-soft),_0_22px_48px_-30px_rgba(20,192,138,.5)]">

      {/* Gradient top line */}
      <div className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-ld-grad
                      transition-transform duration-[400ms] ease-[cubic-bezier(.4,.8,.3,1)]
                      group-hover:scale-x-100" />

      {/* Icon tile */}
      <div className="w-[42px] h-[42px] rounded-[12px] grid place-items-center mb-4
                      border border-ld-border bg-ld-surface-2 text-ld-accent
                      transition-all duration-300
                      group-hover:bg-ld-grad group-hover:border-transparent
                      group-hover:text-ld-grad-text group-hover:shadow-ld-glow">
        <Icon className="w-5 h-5" />
      </div>

      <h3 className="text-[16px] font-bold mb-[7px] text-ld-text">{title}</h3>
      <p className="text-ld-text-2 text-[13.5px] leading-[1.55]">{desc}</p>
    </div>
  );
}
