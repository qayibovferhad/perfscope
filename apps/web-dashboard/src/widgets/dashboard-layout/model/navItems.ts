import type { LucideIcon } from 'lucide-react';
import { Gauge, GitCompareArrows, History, LayoutGrid, Moon, Puzzle, Settings } from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

// Ordered by workflow: the two audit entry points first, then the sites you audit,
// then past results, then automate/extend. Keep new entries inside the group they belong to.
export const NAV: NavItem[] = [
  // Run
  { to: '/app',        icon: Gauge,            label: 'New Audit'   },
  { to: '/compare',    icon: GitCompareArrows, label: 'Compare'     },
  // Manage
  { to: '/websites',   icon: LayoutGrid,       label: 'My Websites' },
  // Review
  { to: '/history',    icon: History,          label: 'History'     },
  // Automate / extend
  { to: '/automation', icon: Moon,             label: 'Automation'  },
  { to: '/extension',  icon: Puzzle,           label: 'Extension'   },
  // Account
  { to: '/settings',   icon: Settings,         label: 'Settings'    },
];
