import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

/**
 * The centred card the signed-out pages share.
 *
 * Login and register each hand-wrote this shell — the two blobs, the panel, the logo, the
 * fade-in — and the password-reset pair would have made four copies of it. It lives in
 * `shared/` rather than beside one of them because a page may not import another page's
 * `ui/`, and these are four pages.
 *
 * Deliberately not `Page`/`PageHeader`: those describe a route *inside* the dashboard
 * shell, with its sidebar and its column width. A signed-out screen has no shell.
 */
export function AuthCard({ title, subtitle, children }: {
  title:    string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-ps-page">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-[130px] bg-[image:var(--ld-blob-tl)]" />
      <div className="pointer-events-none absolute right-0 top-0 w-[350px] h-[350px] rounded-full blur-[120px] bg-[image:var(--ld-blob-br)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="ps-panel relative z-10 flex flex-col gap-6 p-8 w-full max-w-[400px]"
      >
        <div className="flex flex-col items-center gap-2.5">
          <Link to="/">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[image:var(--ld-grad)] shadow-glow-accent-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
          </Link>
          <div className="text-center">
            <h1 className="text-xl font-extrabold tracking-tight leading-none font-mono">
              <span className="text-ps-heading">Perf</span>
              <span className="ps-gradient-text">Scope</span>
            </h1>
            <p className="text-xs mt-1 text-ps-muted">{subtitle}</p>
          </div>
        </div>

        <h2 className="sr-only">{title}</h2>
        {children}
      </motion.div>
    </div>
  );
}
