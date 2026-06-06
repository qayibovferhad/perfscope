import type { LucideIcon } from 'lucide-react';
import { GitCompareArrows, History, LayoutGrid, Moon, Puzzle } from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

export const NAV: NavItem[] = [
  { to: '/compare',    icon: GitCompareArrows, label: 'Compare'     },
  { to: '/history',    icon: History,          label: 'History'     },
  { to: '/websites',   icon: LayoutGrid,       label: 'My Websites' },
  { to: '/automation', icon: Moon,             label: 'Automation'  },
  { to: '/extension',  icon: Puzzle,           label: 'Extension'   },
];
