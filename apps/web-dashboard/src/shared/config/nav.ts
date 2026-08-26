import type { LucideIcon } from 'lucide-react';
import { CalendarClock, Footprints, Gauge, GitCompareArrows, History, LayoutDashboard, LayoutGrid, Moon, Puzzle, Settings, Users } from 'lucide-react';

/**
 * The workspace's navigation, in one place.
 *
 * It lives in `shared` rather than beside the sidebar because two widgets read it now —
 * the sidebar draws it, and the command palette makes every entry reachable by name. A
 * widget may not import another widget, and a second hand-maintained copy of this list is
 * how a new page ends up in one of them and not the other.
 */
export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

// Ordered by workflow: the two audit entry points first, then the sites you audit,
// then past results, then automate/extend. Keep new entries inside the group they belong to.
export const NAV: NavItem[] = [
  // Review at a glance — the landing screen, so it leads
  { to: '/dashboard',  icon: LayoutDashboard,  label: 'Dashboard'   },
  // Run
  { to: '/app',        icon: Gauge,            label: 'New Audit'   },
  { to: '/compare',    icon: GitCompareArrows, label: 'Compare'     },
  { to: '/flows',      icon: Footprints,       label: 'User flows'  },
  // Manage
  { to: '/websites',   icon: LayoutGrid,       label: 'My Websites' },
  // Review
  { to: '/history',    icon: History,          label: 'History'     },
  // Automate / extend. The pair reads as one sentence: the schedule is what you set, the
  // reports are what it brought back — which is also why the results page sits right under
  // it rather than with the audit lists, which deliberately leave those runs out.
  { to: '/automation', icon: Moon,             label: 'Audit schedule'    },
  { to: '/scheduled',  icon: CalendarClock,    label: 'Scheduled reports' },
  { to: '/extension',  icon: Puzzle,           label: 'Extension'   },
  // Account
  { to: '/team',       icon: Users,            label: 'Teams'       },
  { to: '/settings',   icon: Settings,         label: 'Settings'    },
];
