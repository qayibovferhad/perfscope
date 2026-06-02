import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Eye, CheckCircle, Gauge } from 'lucide-react';
import { PerformanceDashboard } from './PerformanceDashboard';

const HIGHLIGHTS = [
  'Core Web Vitals dashboard',
  'AI fix suggestions',
  'Regression alerts',
];

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = (delay = 0.11) => ({
  hidden:  {},
  visible: { transition: { staggerChildren: delay } },
});

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.93 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function HeroSection() {
  return (
    <section className="relative flex-1 flex items-center px-6 overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full blur-[120px] bg-indigo-500/[0.09]" />
      <div className="pointer-events-none absolute right-0 top-0 w-[450px] h-[450px] rounded-full blur-[140px] bg-violet-500/[0.07]" />
      <div className="pointer-events-none absolute left-0 bottom-0 w-[350px] h-[350px] rounded-full blur-[120px] bg-emerald-500/[0.05]" />

      <div className="max-w-6xl mx-auto w-full pb-10">
        <motion.div variants={stagger(0.1)} initial="hidden" animate="visible"
          className="grid lg:grid-cols-2 gap-16 items-center">

          <div className="space-y-8">
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full font-mono bg-ps-accent-muted border border-ps-accent-border text-violet-300">
                <Gauge className="w-3 h-3" /> v1.0 · Lighthouse-Powered
              </span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-ps-heading">
              Stop Guessing.{' '}
              <span className="ps-gradient-text">Start Visualizing</span>{' '}
              Performance.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg leading-relaxed max-w-lg text-ps-secondary">
              The first Lighthouse-powered audit tool that visualizes Core Web Vitals in
              real-time and tracks performance regressions with deep historical analytics.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
              <Link to="/app" className="ps-btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold">
                <Zap className="w-4 h-4" /> Start Your Audit
              </Link>
              <Link to="/app" className="ps-btn-ghost inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold">
                <Eye className="w-4 h-4" /> View Demo
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-5">
              {HIGHLIGHTS.map(label => (
                <div key={label} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0 text-ps-healthy" />
                  <span className="text-xs text-ps-muted">{label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div variants={scaleIn} className="flex justify-center lg:justify-end">
            <PerformanceDashboard />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
