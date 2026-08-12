import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { AddWebsiteModal } from '@/features/websites/ui/AddWebsiteModal';
import { Sidebar } from './ui/Sidebar';
import { StorageBanner } from './ui/StorageBanner';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // A new route starts at the top. The window never scrolls here — `main` is the scroll
  // container — so the browser's own restoration does nothing and, without this, arriving
  // on a page lands you wherever the previous one happened to be scrolled to.
  // Keyed on pathname only: the analyzer rewrites its query string mid-run, and yanking
  // the reader back to the top while results stream in would be its own bug.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-ld-bg-2">

      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar onAddWebsite={() => setModalOpen(true)} />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-0 top-0 bottom-0 z-50 md:hidden"
            >
              <Sidebar onClose={() => setMobileOpen(false)} onAddWebsite={() => setModalOpen(true)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AddWebsiteModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 shrink-0 border-b border-ld-border">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="-ml-2"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <span className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg grid place-items-center bg-ld-grad shadow-ld-glow">
              <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
                <path d="M3 12h3l2.5-7 4 14 3-9 2 2H21" stroke="#04130d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="font-bold text-[17px] tracking-[-0.02em] text-ld-text">
              Perf<b className="text-ld-accent-2 font-extrabold">Scope</b>
            </span>
          </span>
        </div>

        {/* Outside `main` so it survives the per-route scroll reset above and cannot be
            scrolled away from — the pages below are all showing empty lists because of it. */}
        <StorageBanner />

        <main ref={mainRef} className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
