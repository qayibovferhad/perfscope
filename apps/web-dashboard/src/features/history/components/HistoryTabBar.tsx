import { motion } from 'framer-motion';
import { Activity, GitCompareArrows } from 'lucide-react';
import type { HistoryTab } from '@/features/history/model/types';

interface Props {
  active:   HistoryTab;
  onChange: (t: HistoryTab) => void;
}

const TABS: { key: HistoryTab; label: string; icon: React.ReactNode }[] = [
  { key: 'analysis', label: 'Analysis', icon: <Activity         className="w-3.5 h-3.5" /> },
  { key: 'compare',  label: 'Compare',  icon: <GitCompareArrows className="w-3.5 h-3.5" /> },
];

export function HistoryTabBar({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl w-fit bg-white/[0.04] border border-ps-surface-border">
      {TABS.map(({ key, label, icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
            style={{ color: isActive ? 'var(--ps-text-heading)' : 'var(--ps-text-muted)' }}
          >
            {isActive && (
              <motion.div
                layoutId="history-tab-pill"
                className="absolute inset-0 rounded-lg bg-ps-accent-hover border border-ps-accent-border"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span
              className="relative z-10 flex items-center gap-2"
              style={{ color: isActive ? 'var(--ps-accent)' : 'inherit' }}
            >
              {icon}{label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
