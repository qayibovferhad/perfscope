import { useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Globe, LogOut, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ConfirmModal } from '@/shared/ui/modal';
import { signOut, useAuthStore } from '@/features/auth';
import { useWebsites, getHostname } from '@/entities/website';
import { NotificationBell } from '@/features/notifications';
import { RunningAudits } from './RunningAudits';
import { TeamSwitcher } from '@/features/teams';
import { useCanEdit } from '@/shared/model/teamStore';
import { useAllHistory } from '@/entities/history';
import { NAV } from '@/shared/config/nav';
import { usePaletteStore } from '@/shared/model/paletteStore';

interface SidebarProps {
  onClose?: () => void;
  onAddWebsite: () => void;
}

export function Sidebar({ onClose, onAddWebsite }: SidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore(s => s.user);
  const { websites, remove } = useWebsites();
  const { data: allHistory = [] } = useAllHistory();

  const sortedWebsites = useMemo(() => {
    if (!allHistory.length) return websites;
    const lastAuditAt: Record<string, number> = {};
    for (const entry of allHistory) {
      const t = new Date(entry.timestamp).getTime();
      if (!lastAuditAt[entry.url] || t > lastAuditAt[entry.url]) {
        lastAuditAt[entry.url] = t;
      }
    }
    return [...websites].sort((a, b) => (lastAuditAt[b.url] ?? 0) - (lastAuditAt[a.url] ?? 0));
  }, [websites, allHistory]);

  // A viewer's writes are refused by the server; disabling the primary action says so
  // before they fill a form in, which is the difference between a rule and a dead end.
  const canEdit = useCanEdit();

  const [logoutOpen, setLogoutOpen] = useState(false);

  function handleLogout() {
    setLogoutOpen(false);
    // Ends the session on the server too, not just in this tab — see signOut.
    signOut();
    navigate('/login', { replace: true });
  }

  function openProject(id: string) {
    onClose?.();
    navigate(`/projects/${id}`);
  }

  return (
    <aside className="flex flex-col w-72 h-screen sticky top-0 overflow-y-auto border-r border-ld-border bg-ld-bg-2 px-5 py-6">

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-1 pb-5">
        {/* Straight to the dashboard, not to "/". This sidebar only exists for a signed-in
            user, and routing them through the landing page tore the whole shell down and
            rebuilt it a frame later — the redirect was correct and the flash was real. */}
        <Link to="/dashboard" className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="w-[36px] h-[36px] rounded-[11px] grid place-items-center bg-ld-grad shadow-ld-glow shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]">
              <path d="M3 12h3l2.5-7 4 14 3-9 2 2H21" stroke="#04130d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="font-bold text-[18px] tracking-[-0.02em] text-ld-text">
            Perf<b className="text-ld-accent-2 font-extrabold">Scope</b>
          </span>
        </Link>
        {/* In the brand row rather than beside the nav: it belongs to the account, not to
            a page, and this is the one row that is on screen whatever route is open. */}
        <NotificationBell />
        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close sidebar"
            className="shrink-0"
          >
            <X />
          </Button>
        )}
      </div>

      {/* Directly under the brand, because it re-labels everything below it: which account's
          sites, history and flows this sidebar is listing. Renders nothing for someone who
          is in no team — most people never see it. */}
      <TeamSwitcher />

      {/* Above the primary action and the nav: an audit in flight is the most
          time-sensitive thing on the screen, and it is why someone came back. */}
      <RunningAudits onNavigate={onClose} />

      {/* Add Website */}
      <Button
        className="w-full"
        onClick={() => { onAddWebsite(); onClose?.(); }}
        disabled={!canEdit}
        title={canEdit ? undefined : 'You have view-only access to this team'}
      >
        <Plus className="w-[17px] h-[17px]" />
        Add Website
      </Button>

      {/*
        The palette's only advertisement. A shortcut nobody is told about is a shortcut
        nobody uses, and the row doubles as the button for anyone not on a keyboard.
      */}
      <button
        onClick={() => { usePaletteStore.getState().setOpen(true); onClose?.(); }}
        className="mt-2.5 w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] border border-ld-border text-ld-text-3 hover:text-ld-text hover:border-ld-accent-line transition-colors"
      >
        <Search className="w-[15px] h-[15px] shrink-0" />
        <span className="flex-1 text-left text-[13px]">Search…</span>
        <kbd className="font-mono text-[10px] font-bold border border-ld-border rounded px-1.5 py-px">⌘K</kbd>
      </button>

      {/* My Websites */}
      {sortedWebsites.length > 0 && (
        <>
          <p className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-ld-text-3 pt-[22px] pb-2.5 px-1">
            My Websites
          </p>
          <div>
            {sortedWebsites.slice(0, 3).map((site) => {
              const isActive = pathname === `/projects/${site._id}`;
              return (
                <div
                  key={site._id}
                  onClick={() => openProject(site._id)}
                  className={`group flex items-center gap-[11px] px-2.5 py-[9px] rounded-[10px] cursor-pointer transition-all duration-200 ${
                    isActive
                      ? 'bg-ld-accent-soft shadow-ld-ring-accent'
                      : 'hover:bg-ld-surface-hover'
                  }`}
                >
                  <span className={`w-[26px] h-[26px] rounded-[7px] grid place-items-center border shrink-0 transition-colors duration-200 ${
                    isActive
                      ? 'border-ld-accent-line text-ld-accent bg-ld-surface-2'
                      : 'border-ld-border bg-ld-surface-2 text-ld-text-3'
                  }`}>
                    <Globe className="w-[14px] h-[14px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[13.5px] font-semibold text-ld-text truncate">
                      {site.name || getHostname(site.url)}
                    </b>
                    <span className="block text-[11.5px] text-ld-text-3 font-mono truncate">
                      {getHostname(site.url)}
                    </span>
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove.mutate(site._id); }}
                    title="Remove"
                    className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-ld-text-3 hover:text-ld-rose"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {sortedWebsites.length > 3 && (
              <Link
                to="/websites"
                onClick={onClose}
                className="flex items-center gap-1.5 px-2.5 py-1.5 mt-1 rounded-lg text-[11px] font-medium text-ld-accent hover:bg-ld-accent-soft transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
                View all {sortedWebsites.length} websites
              </Link>
            )}
          </div>
        </>
      )}

      {/* Workspace nav */}
      <p className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-ld-text-3 pt-[22px] pb-2.5 px-1">
        Workspace
      </p>
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `group flex items-center gap-[11px] px-2.5 py-[9px] rounded-[10px] text-[14px] font-medium no-underline transition-colors duration-200 ${
                isActive
                  ? 'bg-ld-surface text-ld-text shadow-ld-ring-border'
                  : 'text-ld-text-2 hover:bg-ld-surface-hover hover:text-ld-text'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-[17px] h-[17px] shrink-0 transition-colors duration-200 ${
                  isActive
                    ? 'text-ld-accent'
                    : 'text-ld-text-3 group-hover:text-ld-accent'
                }`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="mt-4 pt-4 border-t border-ld-border">
        <div className="group flex items-center gap-3 p-2.5 rounded-[13px] border border-ld-border bg-ld-surface-2 transition-colors duration-200 hover:border-ld-accent-line">
          <span className="w-9 h-9 rounded-[11px] grid place-items-center bg-ld-grad shadow-ld-glow text-[#04130d] font-extrabold text-[14px] shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[13px] font-semibold text-ld-text truncate">{user?.name}</b>
            <span className="block text-[11px] text-ld-text-3 font-mono truncate">{user?.email}</span>
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setLogoutOpen(true)}
            aria-label="Sign out"
            className="shrink-0 text-ld-text-3 hover:text-ld-rose"
          >
            <LogOut />
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={logoutOpen}
        title="Sign out?"
        subtitle="You will need to sign in again to run audits."
        confirmLabel="Sign out"
        confirmIcon={<LogOut />}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      >
        <div className="flex items-center gap-[12px] p-4 rounded-[13px] border border-ld-border bg-ld-surface-2">
          <span className="w-9 h-9 rounded-[11px] grid place-items-center bg-ld-grad shadow-ld-glow text-[#04130d] font-extrabold text-[15px] shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </span>
          <span className="min-w-0">
            <b className="block text-[13.5px] font-semibold text-ld-text truncate">{user?.name}</b>
            <span className="block font-mono text-[12px] text-ld-text-3 truncate">{user?.email}</span>
          </span>
        </div>
        <p className="text-[13px] text-ld-text-2 leading-[1.55]">
          Your websites and audit history stay on your account — nothing is deleted.
        </p>
      </ConfirmModal>
    </aside>
  );
}
