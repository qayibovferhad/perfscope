import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, ArrowRight } from 'lucide-react';

export function NavBar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full z-50"
      style={{
        background:           'rgba(3,7,18,0.72)',
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom:         '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 12px rgba(139,92,246,0.45)' }}>
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span style={{ fontFamily: 'var(--ps-font-mono)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.04em', lineHeight: 1 }}>
            <span style={{ color: '#e2e8f0' }}>Perf</span>
            <span style={{ background: 'linear-gradient(135deg,#8b5cf6 0%,#c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Scope
            </span>
          </span>
        </div>
        <Link to="/app" className="ps-btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold">
          Start Audit <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.nav>
  );
}
