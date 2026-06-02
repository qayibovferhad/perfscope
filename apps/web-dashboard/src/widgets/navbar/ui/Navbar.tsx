import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, ArrowRight } from 'lucide-react';

export function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full z-50 ps-navbar"
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-ps-brand shadow-glow-accent">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-mono font-extrabold text-[1.2rem] tracking-[-0.04em] leading-none">
            <span className="text-slate-200">Perf</span>
            <span className="ps-logo-gradient">Scope</span>
          </span>
        </div>
        <Link to="/app" className="ps-btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold">
          Start Audit <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.nav>
  );
}
