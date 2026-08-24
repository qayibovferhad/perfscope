import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, GitCompareArrows, Globe, Moon, Sun, LogOut, type LucideIcon } from 'lucide-react';
import { NAV } from '@/shared/config/nav';
import { useTheme } from '@/shared/ui/theme/ThemeProvider';
import { getHostname, useWebsites } from '@/entities/website';
import { useWebsiteActions } from '@/features/websites';
import { signOut } from '@/features/auth';

export interface Command {
  id:      string;
  /** What is matched and shown. Keep it the way someone would say it out loud. */
  label:   string;
  /** Groups the list; also the only thing separating "Compare" the page from a site. */
  group:   string;
  icon:    LucideIcon;
  /** Extra text matched but shown quietly on the right — a URL, a shortcut. */
  hint?:   string;
  run:     () => void;
}

/**
 * Everything the palette can do, rebuilt when the account's sites change.
 *
 * Sites come before pages in the ordering that survives an empty query: with nothing
 * typed the useful thing to offer is "audit one of your sites", which is what the app is
 * for, rather than a list of routes the sidebar is already showing.
 */
export function useCommands(): Command[] {
  const navigate = useNavigate();
  const { websites } = useWebsites();
  const { quickAudit, startCompare } = useWebsiteActions();
  const { theme, toggle } = useTheme();

  return useMemo(() => {
    const siteCommands = websites.flatMap((site) => {
      const host = getHostname(site.url);
      return [
        {
          id: `audit-${site._id}`, label: `Audit ${host}`, group: 'Sites',
          icon: Gauge, hint: site.url,
          run: () => quickAudit(site.url, site._id),
        },
        {
          id: `open-${site._id}`, label: `Open ${host}`, group: 'Sites',
          icon: Globe, hint: 'site detail',
          run: () => navigate(`/projects/${site._id}`),
        },
        {
          id: `compare-${site._id}`, label: `Compare ${host}`, group: 'Sites',
          icon: GitCompareArrows, hint: 'against another site',
          run: () => startCompare(site.url),
        },
      ];
    });

    const pages = NAV.map(item => ({
      id: `nav-${item.to}`, label: item.label, group: 'Go to',
      icon: item.icon, hint: item.to,
      run: () => navigate(item.to),
    }));

    const actions: Command[] = [
      {
        id: 'theme', label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        group: 'Actions', icon: theme === 'dark' ? Sun : Moon, run: toggle,
      },
      {
        id: 'logout', label: 'Log out', group: 'Actions', icon: LogOut,
        run: () => { signOut(); navigate('/login'); },
      },
    ];

    return [...siteCommands, ...pages, ...actions];
  }, [websites, navigate, quickAudit, startCompare, theme, toggle]);
}
