import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, Eye, CheckCircle, Globe, Gauge } from 'lucide-react';
import { fadeUp, stagger, scaleIn } from '../lib/animations';
import { PANEL, GLASS } from '../lib/tokens';

// ─── Performance Dashboard card ───────────────────────────────────────────────

const SPARK_DATA = [38, 47, 55, 63, 71, 79, 87, 94];
const SW = 240, SH = 50;

function PerformanceDashboard() {
  const score  = 94;
  const radius = 42;
  const circ   = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;

  const sparkPts = SPARK_DATA.map((v, i) => {
    const x = (i / (SPARK_DATA.length - 1)) * SW;
    const y = SH - (v / 100) * SH;
    return `${x},${y}`;
  }).join(' ');

  const metrics = [
    { label: 'LCP',  value: '1.2s',  color: '#10b981', status: 'Good'       },
    { label: 'CLS',  value: '0.08',  color: '#10b981', status: 'Good'       },
    { label: 'TBT',  value: '140ms', color: '#f59e0b', status: 'Needs Work' },
    { label: 'FCP',  value: '0.9s',  color: '#10b981', status: 'Good'       },
  ];

  return (
    <motion.div variants={scaleIn} style={{ ...PANEL, border: '1px solid rgba(139,92,246,0.22)', boxShadow: '0 0 100px rgba(139,92,246,0.13), 0 32px 64px rgba(0,0,0,0.55)', maxWidth: 500, width: '100%' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444', opacity: 0.7 }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b', opacity: 0.7 }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981', opacity: 0.7 }} />
          <span className="ml-2 text-xs" style={{ color: 'var(--ps-text-muted)', fontFamily: 'var(--ps-font-mono)' }}>
            perfscope — audit
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.30)', color: '#10b981' }}>
          ● DONE
        </span>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Globe className="w-3 h-3 shrink-0" style={{ color: 'var(--ps-text-muted)' }} />
          <span className="text-[11px] flex-1" style={{ color: 'var(--ps-text-secondary)', fontFamily: 'var(--ps-font-mono)' }}>
            https://example.com
          </span>
          <span className="text-[9px] font-mono font-semibold" style={{ color: '#10b981' }}>1.8s</span>
        </div>

        <div className="flex items-center gap-5">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <motion.circle cx="50" cy="50" r={radius} fill="none" stroke="#10b981" strokeWidth="6"
                strokeLinecap="round" strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ - filled }}
                transition={{ duration: 1.6, ease: 'easeOut', delay: 0.4 }}
                style={{ filter: 'drop-shadow(0 0 8px #10b981)' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold leading-none" style={{ color: '#10b981', fontFamily: 'var(--ps-font-mono)' }}>{score}</span>
              <span className="text-[9px] mt-0.5" style={{ color: 'var(--ps-text-muted)' }}>/ 100</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 flex-1">
            {metrics.map(({ label, value, color, status }) => (
              <div key={label} className="flex flex-col gap-0.5 px-2.5 py-2 rounded-lg"
                style={{ background: `${color}0D`, border: `1px solid ${color}25` }}>
                <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--ps-text-muted)' }}>{label}</span>
                <span className="text-sm font-extrabold" style={{ color, fontFamily: 'var(--ps-font-mono)' }}>{value}</span>
                <span className="text-[8px]" style={{ color: `${color}BB` }}>{status}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={GLASS} className="p-3 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ps-text-muted)' }}>Score History</p>
          <svg viewBox={`0 0 ${SW} ${SH}`} className="w-full" style={{ height: 48, overflow: 'visible' }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"    />
              </linearGradient>
            </defs>
            <polygon points={`0,${SH} ${sparkPts} ${SW},${SH}`} fill="url(#sparkFill)" />
            <polyline points={sparkPts} fill="none" stroke="#8b5cf6" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 5px rgba(139,92,246,0.7))' }} />
            <circle cx={SW} cy={SH - (94 / 100) * SH} r="3.5" fill="#8b5cf6"
              style={{ filter: 'drop-shadow(0 0 5px #8b5cf6)' }} />
          </svg>
          <div className="flex justify-between">
            {SPARK_DATA.map((v, i) => (
              <span key={i} className="text-[8px] font-mono"
                style={{ color: i === SPARK_DATA.length - 1 ? '#8b5cf6' : 'var(--ps-text-faint)' }}>
                {v}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.20)' }}>
          <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#10b981' }} />
          <span className="text-[11px] font-semibold" style={{ color: '#10b981' }}>All Core Web Vitals passing</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

export function HeroSection() {
  return (
    <section className="relative flex-1 flex items-center px-6 overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full blur-[120px]"
        style={{ background: 'rgba(99,102,241,0.09)' }} />
      <div className="pointer-events-none absolute right-0 top-0 w-[450px] h-[450px] rounded-full blur-[140px]"
        style={{ background: 'rgba(139,92,246,0.07)' }} />
      <div className="pointer-events-none absolute left-0 bottom-0 w-[350px] h-[350px] rounded-full blur-[120px]"
        style={{ background: 'rgba(16,185,129,0.05)' }} />

      <div className="max-w-6xl mx-auto w-full pb-10">
        <motion.div variants={stagger(0.1)} initial="hidden" animate="visible"
          className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', fontFamily: 'var(--ps-font-mono)' }}>
                <Gauge className="w-3 h-3" /> v1.0 · Lighthouse-Powered
              </span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight"
              style={{ color: 'var(--ps-text-heading)' }}>
              Stop Guessing.{' '}
              <span style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Start Visualizing
              </span>{' '}
              Performance.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg leading-relaxed max-w-lg" style={{ color: 'var(--ps-text-secondary)' }}>
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
              {['Core Web Vitals dashboard', 'AI fix suggestions', 'Regression alerts'].map((label) => (
                <div key={label} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#10b981' }} />
                  <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>{label}</span>
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
