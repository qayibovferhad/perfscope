import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { SCORE_GOOD, SCORE_BAD } from '@/entities/analysis';
import { BenchmarkPanel } from './BenchmarkPanel';

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

type DeltaStatus = 'healthy' | 'accent' | 'warning' | 'danger';

const STATUS_CLASSES: Record<DeltaStatus, string> = {
  healthy: 'bg-ps-healthy-muted border-ps-healthy-border text-ps-healthy',
  accent:  'bg-ps-accent-muted  border-ps-accent-border  text-ps-accent',
  warning: 'bg-ps-amber-muted   border-ps-amber-border   text-ps-amber',
  danger:  'bg-ps-reg-muted     border-ps-reg-border     text-ps-regression',
};

const DELTAS: { label: string; delta: string; status: DeltaStatus }[] = [
  { label: 'Performance', delta: '+52 pts', status: 'healthy' },
  { label: 'CLS',         delta: '−82%',    status: 'accent'  },
  { label: 'LCP',         delta: '−75%',    status: 'warning' },
  { label: 'TBT',         delta: '−83%',    status: 'danger'  },
];

export function BenchmarksSection() {
  return (
    <section id="benchmarks" className="py-24 px-6">
      <div className="max-w-6xl mx-auto space-y-14">

        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-80px' }} className="text-center space-y-4">
          <motion.p variants={fadeUp} className="ps-section-label">Proof of Impact</motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold tracking-tight text-ps-heading">
            Real results, before and after.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-base max-w-lg mx-auto text-ps-secondary">
            Teams using PerfScope's AI suggestions ship pages that score 90+ within a single sprint.
          </motion.p>
        </motion.div>

        <motion.div variants={stagger(0.15)} initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-60px' }} className="relative grid md:grid-cols-2 gap-6">
          <motion.div variants={fadeUp}>
            <BenchmarkPanel label="Before PerfScope" tag="Baseline"  tagColor={SCORE_BAD}  perf={42} cls="0.45" lcp="4.8s" tbt="820ms" />
          </motion.div>
          <div className="hidden md:flex absolute inset-y-0 left-1/2 -translate-x-1/2 items-center justify-center z-10">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-ps-brand shadow-[0_0_24px_rgba(139,92,246,0.5)]">
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </div>
          <motion.div variants={fadeUp}>
            <BenchmarkPanel label="After PerfScope"  tag="Optimized" tagColor={SCORE_GOOD} perf={94} cls="0.08" lcp="1.2s" tbt="140ms" />
          </motion.div>
        </motion.div>

        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="visible"
          viewport={{ once: true }} className="flex flex-wrap justify-center gap-3">
          {DELTAS.map(({ label, delta, status }) => (
            <motion.div key={label} variants={scaleIn}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border ${STATUS_CLASSES[status]}`}>
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-sm font-bold font-mono">{delta}</span>
              <span className="text-xs text-ps-muted">{label}</span>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
