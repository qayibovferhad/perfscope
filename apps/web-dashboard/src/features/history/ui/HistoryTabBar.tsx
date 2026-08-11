import { Activity, GitCompareArrows } from 'lucide-react';
import { TabBar, type TabItem } from '@/shared/ui/tab-bar';
import type { HistoryTab } from '../model/types';

const TABS: TabItem<HistoryTab>[] = [
  { key: 'analysis', label: 'Analysis', icon: <Activity         className="w-[16px] h-[16px]" /> },
  { key: 'compare',  label: 'Compare',  icon: <GitCompareArrows className="w-[16px] h-[16px]" /> },
];

export function HistoryTabBar({
  active, onChange,
}: {
  active:   HistoryTab;
  onChange: (t: HistoryTab) => void;
}) {
  return <TabBar tabs={TABS} active={active} onChange={onChange} ariaLabel="History view" />;
}
