import { Activity, GitCompareArrows } from 'lucide-react';
import type { HistoryTab } from '../model/types';

const TABS = [
  { key: 'analysis' as HistoryTab, label: 'Analysis', icon: <Activity         className="w-[16px] h-[16px]" /> },
  { key: 'compare'  as HistoryTab, label: 'Compare',  icon: <GitCompareArrows className="w-[16px] h-[16px]" /> },
];

export function HistoryTabBar({
  active, onChange,
}: {
  active:   HistoryTab;
  onChange: (t: HistoryTab) => void;
}) {
  return (
    <div className="inline-flex gap-[3px] p-[4px] rounded-[13px] border border-ld-border bg-ld-surface-2">
      {TABS.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`inline-flex items-center gap-[8px] text-[14px] font-medium px-[18px] py-[10px] rounded-[10px] border transition-all duration-200 ${
            active === key
              ? 'bg-ld-accent-soft border-ld-accent-line text-ld-accent-2 font-semibold'
              : 'bg-transparent border-transparent text-ld-text-2 hover:text-ld-text'
          }`}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}
