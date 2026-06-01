import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { fadeUp, stagger, scaleIn } from '../lib/animations';
import { PANEL } from '../lib/tokens';

// ─── Score Gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 90 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const circ  = 2 * Math.PI * 28;
  const dash  = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <motion.circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            whileInView={{ strokeDashoffset: circ - dash }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-extrabold" style={{ color, fontFamily: 'var(--ps-font-mono)' }}>{score}</span>
        </div>
      </div>
      <p className="text-xs font-medium" style={{ color: 'var(--ps-text-muted)' }}>{label}</p>
    </div>
  );
}

// ─── Benchmark Panel ──────────────────────────────────────────────────────────

function BenchmarkPanel({ label, tag, tagColor, perf, cls, lcp, tbt }: {
  label: string; tag: string; tagColor: string;
  perf: number; cls: string; lcp: string; tbt: string;
}) {
  return (
    <div style={PANEL} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm" style={{ color: 'var(--ps-text-heading)' }}>{label}</h4>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${tagColor}18`, border: `1px solid ${tagColor}40`, color: tagColor }}>
          {tag}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3 justify-items-center">
        <ScoreGauge score={perf} label="Performance" />
        {[
          { val: cls, label: 'CLS', color: parseFloat(cls) < 0.1 ? '#10b981' : parseFloat(cls) < 0.25 ? '#f59e0b' : '#ef4444' },
          { val: lcp, label: 'LCP', color: parseFloat(lcp) < 2.5 ? '#10b981' : parseFloat(lcp) < 4   ? '#f59e0b' : '#ef4444' },
          { val: tbt, label: 'TBT', color: parseInt(tbt)   < 200  ? '#10b981' : parseInt(tbt)   < 600  ? '#f59e0b' : '#ef4444' },
        ].map(({ val, label: ml, color }) => (
          <div key={ml} className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-xl flex flex-col items-center justify-center"
              style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
              <span className="text-xl font-extrabold" style={{ color, fontFamily: 'var(--ps-font-mono)' }}>{val}</span>
            </div>
            <p className="text-xs font-medium" style={{ color: 'var(--ps-text-muted)' }}>{ml}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function BenchmarksSection() {
  return (
    <section id="benchmarks" className="py-24 px-6">
      <div className="max-w-6xl mx-auto space-y-14">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-80px' }} className="text-center space-y-4">
          <motion.p variants={fadeUp} className="ps-section-label">Proof of Impact</motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--ps-text-heading)' }}>
            Real results, before and after.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-base max-w-lg mx-auto" style={{ color: 'var(--ps-text-secondary)' }}>
            Teams using PerfScope's AI suggestions ship pages that score 90+ within a single sprint.
          </motion.p>
        </motion.div>

        <motion.div variants={stagger(0.15)} initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-60px' }} className="relative grid md:grid-cols-2 gap-6">
          <motion.div variants={fadeUp}>
            <BenchmarkPanel label="Before PerfScope" tag="Baseline" tagColor="#ef4444" perf={42} cls="0.45" lcp="4.8s" tbt="820ms" />
          </motion.div>
          <div className="hidden md:flex absolute inset-y-0 left-1/2 -translate-x-1/2 items-center justify-center z-10">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 24px rgba(139,92,246,0.5)' }}>
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </div>
          <motion.div variants={fadeUp}>
            <BenchmarkPanel label="After PerfScope" tag="Optimized" tagColor="#10b981" perf={94} cls="0.08" lcp="1.2s" tbt="140ms" />
          </motion.div>
        </motion.div>

        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="visible"
          viewport={{ once: true }} className="flex flex-wrap justify-center gap-3">
          {[
            { label: 'Performance', delta: '+52 pts', color: '#10b981' },
            { label: 'CLS',         delta: '−82%',    color: '#10b981' },
            { label: 'LCP',         delta: '−75%',    color: '#10b981' },
            { label: 'TBT',         delta: '−83%',    color: '#10b981' },
          ].map(({ label, delta, color }) => (
            <motion.div key={label} variants={scaleIn}
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color }} />
              <span className="text-sm font-bold" style={{ color, fontFamily: 'var(--ps-font-mono)' }}>{delta}</span>
              <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>{label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
