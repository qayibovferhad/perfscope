import { Globe, Settings2 } from 'lucide-react';
import { getHostname }      from '@/entities/website';
import type { Website }     from '@/entities/website';

interface Props {
  site:    Website;
  onSetup: () => void;
}

export function UnconfiguredRow({ site, onSetup }: Props) {
  const hostname = getHostname(site.url);

  return (
    <div className="flex items-center gap-[13px] px-[18px] py-[15px] rounded-[14px] border border-ld-border bg-ld-surface
                    transition-[border-color,transform] duration-[250ms]
                    hover:border-ld-accent-line hover:translate-x-[3px]">
      <div className="w-[38px] h-[38px] rounded-[10px] grid place-items-center shrink-0 bg-ld-surface-2 border border-ld-border text-ld-text-3">
        <Globe className="w-[18px] h-[18px]" />
      </div>

      <div className="flex-1 min-w-0">
        <b className="block text-[14.5px] font-semibold text-ld-text">{site.name || hostname}</b>
        <span className="block font-mono text-[12px] text-ld-text-3 mt-0.5 truncate">{hostname}</span>
      </div>

      <button
        onClick={onSetup}
        className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-[9px] rounded-[10px]
                   border border-dashed border-ld-border-strong text-ld-text bg-transparent
                   transition-all duration-200
                   hover:border-solid hover:border-ld-accent-line hover:text-ld-accent hover:bg-ld-accent-soft"
      >
        <Settings2 className="w-[15px] h-[15px]" />
        Set up
      </button>
    </div>
  );
}
