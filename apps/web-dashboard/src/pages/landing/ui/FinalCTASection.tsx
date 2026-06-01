import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Code2 } from 'lucide-react';
import { fadeUp, stagger, scaleIn } from '../lib/animations';

export function FinalCTASection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div variants={stagger(0.1)} initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}>
          <motion.div variants={scaleIn}
            className="relative rounded-2xl overflow-hidden p-12 text-center space-y-6"
            style={{
              background: 'linear-gradient(135deg,rgba(99,102,241,0.12) 0%,rgba(139,92,246,0.08) 50%,rgba(17,24,39,0.9) 100%)',
              border:     '1px solid rgba(139,92,246,0.2)',
              boxShadow:  '0 0 80px rgba(99,102,241,0.12), 0 0 0 1px rgba(139,92,246,0.10)',
            }}>
            <div className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 0%,rgba(139,92,246,0.18) 0%,transparent 60%)' }} />
            <motion.p variants={fadeUp} className="ps-section-label relative z-10">Ready to Optimize?</motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl font-extrabold tracking-tight relative z-10"
              style={{ color: 'var(--ps-text-heading)' }}>
              Your next audit is one click away.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-base max-w-md mx-auto relative z-10"
              style={{ color: 'var(--ps-text-secondary)' }}>
              Paste a URL and get a full Lighthouse audit, CLS filmstrip, regression
              comparison, and AI fix plan — in under 60 seconds.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3 relative z-10">
              <Link to="/app" className="ps-btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm">
                <Zap className="w-4 h-4" /> Start Your Audit — Free
              </Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                className="ps-btn-ghost inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm">
                <Code2 className="w-4 h-4" /> View on GitHub
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
