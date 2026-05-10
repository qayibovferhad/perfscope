import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Activity, Zap, ExternalLink, Layers,
  Sparkles, TrendingUp, Eye, Code2, CheckCircle,
  Network, Globe, Gauge,
  ShieldCheck,
  Scale,
  History,
  BarChart3,
} from 'lucide-react';

// ─── Animation primitives ─────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = (delay = 0.11) => ({
  hidden: {},
  visible: { transition: { staggerChildren: delay } },
});

const scaleIn = {
  hidden: { opacity: 0, scale: 0.93 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Design tokens ────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  background:           'var(--ps-panel-bg)',
  backdropFilter:       'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border:               '1px solid var(--ps-panel-border)',
  borderRadius:         '1.25rem',
  overflow:             'hidden',
};

const GLASS: React.CSSProperties = {
  background:           'rgba(255,255,255,0.035)',
  backdropFilter:       'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border:               '1px solid rgba(255,255,255,0.08)',
  borderRadius:         '0.875rem',
};

// ─── Performance Dashboard Hero Card ─────────────────────────────────────────

const SPARK_DATA = [38, 47, 55, 63, 71, 79, 87, 94];

function PerformanceDashboard() {
  const score        = 94;
  const radius       = 42;
  const circ         = 2 * Math.PI * radius;
  const filled       = (score / 100) * circ;

  // Sparkline SVG path
  const SW = 240, SH = 50;
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
    <motion.div
      variants={scaleIn}
      style={{
        ...PANEL,
        border:    '1px solid rgba(139,92,246,0.22)',
        boxShadow: '0 0 100px rgba(139,92,246,0.13), 0 32px 64px rgba(0,0,0,0.55)',
        maxWidth:  500,
        width:     '100%',
      }}
    >
      {/* Window chrome */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444', opacity: 0.7 }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b', opacity: 0.7 }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981', opacity: 0.7 }} />
          <span
            className="ml-2 text-xs"
            style={{ color: 'var(--ps-text-muted)', fontFamily: 'var(--ps-font-mono)' }}
          >
            perfscope — audit
          </span>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold"
          style={{
            background: 'rgba(16,185,129,0.12)',
            border:     '1px solid rgba(16,185,129,0.30)',
            color:       '#10b981',
          }}
        >
          ● DONE
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* URL bar */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Globe className="w-3 h-3 shrink-0" style={{ color: 'var(--ps-text-muted)' }} />
          <span
            className="text-[11px] flex-1"
            style={{ color: 'var(--ps-text-secondary)', fontFamily: 'var(--ps-font-mono)' }}
          >
            https://example.com
          </span>
          <span
            className="text-[9px] font-mono font-semibold"
            style={{ color: '#10b981' }}
          >
            1.8s
          </span>
        </div>

        {/* Score gauge + metrics */}
        <div className="flex items-center gap-5">
          {/* Gauge */}
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50" cy="50" r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="6"
              />
              <motion.circle
                cx="50" cy="50" r={radius}
                fill="none"
                stroke="#10b981"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ - filled }}
                transition={{ duration: 1.6, ease: 'easeOut', delay: 0.4 }}
                style={{ filter: 'drop-shadow(0 0 8px #10b981)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-3xl font-extrabold leading-none"
                style={{ color: '#10b981', fontFamily: 'var(--ps-font-mono)' }}
              >
                {score}
              </span>
              <span className="text-[9px] mt-0.5" style={{ color: 'var(--ps-text-muted)' }}>
                / 100
              </span>
            </div>
          </div>

          {/* Metric grid */}
          <div className="grid grid-cols-2 gap-2 flex-1">
            {metrics.map(({ label, value, color, status }) => (
              <div
                key={label}
                className="flex flex-col gap-0.5 px-2.5 py-2 rounded-lg"
                style={{ background: `${color}0D`, border: `1px solid ${color}25` }}
              >
                <span
                  className="text-[8px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--ps-text-muted)' }}
                >
                  {label}
                </span>
                <span
                  className="text-sm font-extrabold"
                  style={{ color, fontFamily: 'var(--ps-font-mono)' }}
                >
                  {value}
                </span>
                <span className="text-[8px]" style={{ color: `${color}BB` }}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sparkline */}
        <div style={GLASS} className="p-3 space-y-2">
          <p
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--ps-text-muted)' }}
          >
            Score History
          </p>
          <svg
            viewBox={`0 0 ${SW} ${SH}`}
            className="w-full"
            style={{ height: 48, overflow: 'visible' }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"    />
              </linearGradient>
            </defs>
            <polygon
              points={`0,${SH} ${sparkPts} ${SW},${SH}`}
              fill="url(#sparkFill)"
            />
            <polyline
              points={sparkPts}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 5px rgba(139,92,246,0.7))' }}
            />
            <circle
              cx={SW}
              cy={SH - (94 / 100) * SH}
              r="3.5"
              fill="#8b5cf6"
              style={{ filter: 'drop-shadow(0 0 5px #8b5cf6)' }}
            />
          </svg>
          <div className="flex justify-between">
            {SPARK_DATA.map((v, i) => (
              <span
                key={i}
                className="text-[8px] font-mono"
                style={{
                  color: i === SPARK_DATA.length - 1 ? '#8b5cf6' : 'var(--ps-text-faint)',
                }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>

        {/* Pass badge */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: 'rgba(16,185,129,0.07)',
            border:     '1px solid rgba(16,185,129,0.20)',
          }}
        >
          <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#10b981' }} />
          <span className="text-[11px] font-semibold" style={{ color: '#10b981' }}>
            All Core Web Vitals passing
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── NavBar ───────────────────────────────────────────────────────────────────

function NavBar() {
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
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              boxShadow:  '0 0 12px rgba(139,92,246,0.45)',
            }}
          >
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span
            style={{
              fontFamily:    'var(--ps-font-mono)',
              fontWeight:    800,
              fontSize:      '1.2rem',
              letterSpacing: '-0.04em',
              lineHeight:    1,
            }}
          >
            <span style={{ color: '#e2e8f0' }}>Perf</span>
            <span
              style={{
                background:           'linear-gradient(135deg,#8b5cf6 0%,#c084fc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
              }}
            >
              Scope
            </span>
          </span>
        </div>

        {/* CTA only */}
        <Link
          to="/app"
          className="ps-btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold"
        >
          Start Audit <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.nav>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative flex-1 flex items-center px-6 overflow-hidden">
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full blur-[120px]"
        style={{ background: 'rgba(99,102,241,0.09)' }}
      />
      <div
        className="pointer-events-none absolute right-0 top-0 w-[450px] h-[450px] rounded-full blur-[140px]"
        style={{ background: 'rgba(139,92,246,0.07)' }}
      />
      <div
        className="pointer-events-none absolute left-0 bottom-0 w-[350px] h-[350px] rounded-full blur-[120px]"
        style={{ background: 'rgba(16,185,129,0.05)' }}
      />

      <div className="max-w-6xl mx-auto w-full pb-10">
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          animate="visible"
          className="grid lg:grid-cols-2 gap-16 items-center"
        >
          {/* Left — copy */}
          <div className="space-y-8">
            <motion.div variants={fadeUp}>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                style={{
                  background: 'rgba(139,92,246,0.12)',
                  border:     '1px solid rgba(139,92,246,0.25)',
                  color:      '#a78bfa',
                  fontFamily: 'var(--ps-font-mono)',
                }}
              >
                <Gauge className="w-3 h-3" /> v1.0 · Lighthouse-Powered
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight"
              style={{ color: 'var(--ps-text-heading)' }}
            >
              Stop Guessing.{' '}
              <span
                style={{
                  background:          'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#c084fc 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor:  'transparent',
                  backgroundClip:       'text',
                }}
              >
                Start Visualizing
              </span>{' '}
              Performance.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg leading-relaxed max-w-lg"
              style={{ color: 'var(--ps-text-secondary)' }}
            >
              The first Lighthouse-powered audit tool that visualizes Core Web Vitals in
              real-time and tracks performance regressions with deep historical analytics.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
              <Link
                to="/app"
                className="ps-btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
              >
                <Zap className="w-4 h-4" /> Start Your Audit
              </Link>
              <Link
                to="/app"
                className="ps-btn-ghost inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
              >
                <Eye className="w-4 h-4" /> View Demo
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-5">
              {[
                'Core Web Vitals dashboard',
                'AI fix suggestions',
                'Regression alerts',
              ].map((label) => (
                <div key={label} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#10b981' }} />
                  <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>{label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — dashboard */}
          <motion.div variants={scaleIn} className="flex justify-center lg:justify-end">
            <PerformanceDashboard />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon:        React.ReactNode;
  accentColor: string;
  glowColor:   string;
  title:       string;
  description: string;
  bullets:     string[];
  tag:         string;
}

function FeatureCard({ icon, accentColor, glowColor, title, description, bullets, tag }: FeatureCardProps) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        ...PANEL,
        boxShadow:  `0 0 0 1px rgba(255,255,255,0.05), 0 0 28px ${glowColor}`,
        transition: 'box-shadow 0.25s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 0 0 1px ${accentColor}40, 0 0 48px ${glowColor}, 0 16px 40px rgba(0,0,0,0.4)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 0 0 1px rgba(255,255,255,0.05), 0 0 28px ${glowColor}`;
      }}
    >
      <div className="p-7 space-y-5 h-full">
        {/* Icon + tag */}
        <div className="flex items-start justify-between">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}
          >
            <div style={{ color: accentColor }}>{icon}</div>
          </div>
          <span
            className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: `${accentColor}12`,
              border:     `1px solid ${accentColor}28`,
              color:       accentColor,
            }}
          >
            {tag}
          </span>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-bold" style={{ color: 'var(--ps-text-heading)' }}>
            {title}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ps-text-secondary)' }}>
            {description}
          </p>
        </div>

        <ul className="space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <div
                className="w-1 h-1 rounded-full shrink-0"
                style={{ background: accentColor, boxShadow: `0 0 4px ${accentColor}` }}
              />
              <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

// ─── Features Section ─────────────────────────────────────────────────────────
const FEATURES: FeatureCardProps[] = [
  {
    icon: <BarChart3 className="w-5 h-5" />,
    accentColor: '#8b5cf6',
    glowColor: 'rgba(139,92,246,0.08)',
    tag: 'Core',
    title: 'Comprehensive Performance Audit',
    description:
      'Run deep scans using industry-standard engines to get a full breakdown of your application’s speed. We simplify complex web metrics into an understandable performance score.',
    bullets: [
      'Core Web Vitals (LCP, FID, CLS) tracking',
      'Real-world user experience simulation',
      'Mobile and desktop environment testing',
      'Detailed "Time to Interactive" analysis',
    ],
  },
  {
    icon: <Globe className="w-5 h-5" />,
    accentColor: '#0ea5e9',
    glowColor: 'rgba(14,165,233,0.08)',
    tag: 'Market',
    title: 'Competitive Benchmarking',
    description:
      'See how you stack up against the competition. Run side-by-side audits against any live URL to compare your speed, SEO, and quality scores with industry rivals.',
    bullets: [
      'Direct competitor URL comparison',
      'Industry-standard performance ranking',
      'Market-share performance analysis',
      'Identify competitive advantages and gaps',
    ],
  },
  {
    icon: <Scale className="w-5 h-5" />,
    accentColor: '#f43f5e',
    glowColor: 'rgba(244,63,94,0.08)',
    tag: 'Comparison',
    title: 'Internal Audit Compare',
    description:
      'Stop wondering if your latest deployment actually improved things. Select any two of your own audits to see a direct comparison of metrics and highlight drifts.',
    bullets: [
      'Visual "Diff" of performance scores',
      'Metric-by-metric delta tracking (+/-)',
      'Side-by-side filmstrip comparison',
      'Asset-level regression detection',
    ],
  },
  {
    icon: <History className="w-5 h-5" />,
    accentColor: '#3b82f6',
    glowColor: 'rgba(59,130,246,0.08)',
    tag: 'Timeline',
    title: 'Regression & History Tracking',
    description:
      'Monitor how every code change affects your performance over time. By keeping a permanent log of every audit, we help you detect speed drops instantly.',
    bullets: [
      'Unlimited historical audit storage',
      'Visual trend mapping over time',
      'Snapshot archiving for every release',
      'Automatic alerts on performance degradation',
    ],
  },
  {
    icon: <Zap className="w-5 h-5" />,
    accentColor: '#fbbf24',
    glowColor: 'rgba(251,191,36,0.08)',
    tag: 'Real-time',
    title: 'Live Updates & Synchronization',
    description:
      'No more refreshing. Our system uses real-time technology to sync audit results across your entire dashboard the moment they are completed.',
    bullets: [
      'Instant real-time result streaming',
      'Cross-tab data synchronization',
      'Live status monitoring for active audits',
      'Zero-latency reporting dashboard',
    ],
  },
  {
    icon: <Layers className="w-5 h-5" />,
    accentColor: '#f59e0b',
    glowColor: 'rgba(245,158,11,0.08)',
    tag: 'Visual',
    title: 'CLS Visualizer & Filmstrip',
    description:
      'See exactly what your users see. Our visualizer highlights layout shifts frame-by-frame, pinpointing elements that cause frustrating visual instability.',
    bullets: [
      'Frame-by-frame loading playback',
      'Heatmap overlays on unstable elements',
      'Visual "culprit" detection for shifts',
      'User experience stability scoring',
    ],
  },
  {
    icon: <Network className="w-5 h-5" />,
    accentColor: '#06b6d4',
    glowColor: 'rgba(6,182,212,0.08)',
    tag: 'Assets',
    title: 'Network & Resource Analysis',
    description:
      'Map out every request your application makes. Identify heavy images, slow third-party scripts, and resources that delay your page load.',
    bullets: [
      'Full request waterfall visualization',
      'Third-party script impact analysis',
      'Asset size and compression auditing',
      'Identification of blocking resources',
    ],
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    accentColor: '#10b981',
    glowColor: 'rgba(16,185,129,0.08)',
    tag: 'AI-Driven',
    title: 'AI-Powered Smart Fixes',
    description:
      'Get expert-level solutions instantly. Our AI analyzes failing audits to provide technical root-cause explanations and actionable code optimizations.',
    bullets: [
      'AI-generated root cause analysis',
      'Copy-paste ready code suggestions',
      'Prioritized fix roadmaps for LCP/CLS',
      'Context-aware performance advice',
    ],
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    accentColor: '#6366f1',
    glowColor: 'rgba(99,102,241,0.08)',
    tag: 'Quality',
    title: 'Accessibility & SEO Audits',
    description:
      'Ensure your site is inclusive and visible. We audit your application against modern accessibility standards and search engine best practices.',
    bullets: [
      'A11y (Accessibility) compliance checks',
      'SEO structure and meta-data validation',
      'Best-practice industry health scores',
      'Comprehensive brand quality reporting',
    ],
  },
];
function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-[1400px] mx-auto space-y-14">
        {/* Header */}
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center space-y-4"
        >
          <motion.p variants={fadeUp} className="ps-section-label">Features</motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--ps-text-heading)' }}
          >
            Everything you need to ship fast, stable pages.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-base max-w-xl mx-auto"
            style={{ color: 'var(--ps-text-secondary)' }}
          >
            From raw Lighthouse scores to frame-level CLS inspection, network waterfalls,
            and instant AI fixes — one tool, complete visibility.
          </motion.p>
        </motion.div>

        {/* 2 × 2 card grid */}
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Score Gauge (Benchmarks) ─────────────────────────────────────────────────

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 90 ? '#10b981'
    : score >= 50 ? '#f59e0b'
    : '#ef4444';

  const circ = 2 * Math.PI * 28;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <motion.circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            whileInView={{ strokeDashoffset: circ - dash }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-xl font-extrabold"
            style={{ color, fontFamily: 'var(--ps-font-mono)' }}
          >
            {score}
          </span>
        </div>
      </div>
      <p className="text-xs font-medium" style={{ color: 'var(--ps-text-muted)' }}>{label}</p>
    </div>
  );
}

// ─── Benchmark Panel ──────────────────────────────────────────────────────────

function BenchmarkPanel({
  label, tag, tagColor,
  perf, cls, lcp, tbt,
}: {
  label: string; tag: string; tagColor: string;
  perf: number; cls: string; lcp: string; tbt: string;
}) {
  return (
    <div style={PANEL} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm" style={{ color: 'var(--ps-text-heading)' }}>{label}</h4>
        <span
          className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: `${tagColor}18`,
            border:     `1px solid ${tagColor}40`,
            color:       tagColor,
          }}
        >
          {tag}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 justify-items-center">
        <ScoreGauge score={perf} label="Performance" />
        {[
          { val: cls, label: 'CLS', color: parseFloat(cls) < 0.1 ? '#10b981' : parseFloat(cls) < 0.25 ? '#f59e0b' : '#ef4444' },
          { val: lcp, label: 'LCP', color: parseFloat(lcp) < 2.5 ? '#10b981' : parseFloat(lcp) < 4   ? '#f59e0b' : '#ef4444' },
          { val: tbt, label: 'TBT', color: parseInt(tbt)   < 200  ? '#10b981' : parseInt(tbt)   < 600  ? '#f59e0b' : '#ef4444' },
        ].map(({ val, label, color }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div
              className="w-20 h-20 rounded-xl flex flex-col items-center justify-center"
              style={{ background: `${color}10`, border: `1px solid ${color}25` }}
            >
              <span
                className="text-xl font-extrabold"
                style={{ color, fontFamily: 'var(--ps-font-mono)' }}
              >
                {val}
              </span>
            </div>
            <p className="text-xs font-medium" style={{ color: 'var(--ps-text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Benchmarks Section ───────────────────────────────────────────────────────

function BenchmarksSection() {
  return (
    <section id="benchmarks" className="py-24 px-6">
      <div className="max-w-6xl mx-auto space-y-14">
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-center space-y-4"
        >
          <motion.p variants={fadeUp} className="ps-section-label">Proof of Impact</motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--ps-text-heading)' }}
          >
            Real results, before and after.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-base max-w-lg mx-auto"
            style={{ color: 'var(--ps-text-secondary)' }}
          >
            Teams using PerfScope's AI suggestions ship pages that score 90+ within a single sprint.
          </motion.p>
        </motion.div>

        {/* Before / After panels */}
        <motion.div
          variants={stagger(0.15)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="relative grid md:grid-cols-2 gap-6"
        >
          <motion.div variants={fadeUp}>
            <BenchmarkPanel
              label="Before PerfScope"
              tag="Baseline"
              tagColor="#ef4444"
              perf={42} cls="0.45" lcp="4.8s" tbt="820ms"
            />
          </motion.div>

          {/* Center arrow */}
          <div className="hidden md:flex absolute inset-y-0 left-1/2 -translate-x-1/2 items-center justify-center z-10">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                boxShadow:  '0 0 24px rgba(139,92,246,0.5)',
              }}
            >
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </div>

          <motion.div variants={fadeUp}>
            <BenchmarkPanel
              label="After PerfScope"
              tag="Optimized"
              tagColor="#10b981"
              perf={94} cls="0.08" lcp="1.2s" tbt="140ms"
            />
          </motion.div>
        </motion.div>

        {/* Delta pills */}
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-3"
        >
          {[
            { label: 'Performance', delta: '+52 pts', color: '#10b981' },
            { label: 'CLS',         delta: '−82%',    color: '#10b981' },
            { label: 'LCP',         delta: '−75%',    color: '#10b981' },
            { label: 'TBT',         delta: '−83%',    color: '#10b981' },
          ].map(({ label, delta, color }) => (
            <motion.div
              key={label}
              variants={scaleIn}
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: `${color}10`, border: `1px solid ${color}30` }}
            >
              <TrendingUp className="w-3.5 h-3.5" style={{ color }} />
              <span className="text-sm font-bold" style={{ color, fontFamily: 'var(--ps-font-mono)' }}>
                {delta}
              </span>
              <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>{label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Final CTA Section ────────────────────────────────────────────────────────

function FinalCTASection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          <motion.div
            variants={scaleIn}
            className="relative rounded-2xl overflow-hidden p-12 text-center space-y-6"
            style={{
              background: 'linear-gradient(135deg,rgba(99,102,241,0.12) 0%,rgba(139,92,246,0.08) 50%,rgba(17,24,39,0.9) 100%)',
              border:     '1px solid rgba(139,92,246,0.2)',
              boxShadow:  '0 0 80px rgba(99,102,241,0.12), 0 0 0 1px rgba(139,92,246,0.10)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 0%,rgba(139,92,246,0.18) 0%,transparent 60%)' }}
            />

            <motion.p variants={fadeUp} className="ps-section-label relative z-10">
              Ready to Optimize?
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-4xl font-extrabold tracking-tight relative z-10"
              style={{ color: 'var(--ps-text-heading)' }}
            >
              Your next audit is one click away.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-base max-w-md mx-auto relative z-10"
              style={{ color: 'var(--ps-text-secondary)' }}
            >
              Paste a URL and get a full Lighthouse audit, CLS filmstrip, regression
              comparison, and AI fix plan — in under 60 seconds.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-wrap justify-center gap-3 relative z-10"
            >
              <Link
                to="/app"
                className="ps-btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm"
              >
                <Zap className="w-4 h-4" /> Start Your Audit — Free
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ps-btn-ghost inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm"
              >
                <Code2 className="w-4 h-4" /> View on GitHub
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="px-6 py-10"
      style={{ borderTop: '1px solid var(--ps-divider)' }}
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
          >
            <Activity className="w-2.5 h-2.5 text-white" />
          </div>
          <span
            style={{
              fontFamily:    'var(--ps-font-mono)',
              fontWeight:    700,
              fontSize:      '0.9rem',
              letterSpacing: '-0.03em',
              lineHeight:    1,
            }}
          >
            <span style={{ color: '#e2e8f0' }}>Perf</span>
            <span
              style={{
                background:           'linear-gradient(135deg,#8b5cf6 0%,#c084fc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
              }}
            >
              Scope
            </span>
          </span>
        </div>

        <div className="flex items-center gap-6">
          {[
            { href: '/app',     label: 'Analyzer' },
            { href: '/compare', label: 'Compare'  },
            { href: '/history', label: 'History'  },
          ].map(({ href, label }) => (
            <Link
              key={href}
              to={href}
              className="text-xs transition-colors duration-150"
              style={{ color: 'var(--ps-text-muted)' }}
            >
              {label}
            </Link>
          ))}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--ps-text-muted)' }}
          >
            GitHub <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        <p className="text-xs" style={{ color: 'var(--ps-text-faint)', fontFamily: 'var(--ps-font-mono)' }}>
          © 2026 PerfScope · MIT License
        </p>
      </div>
    </footer>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function SectionDivider() {
  return (
    <div className="max-w-6xl mx-auto px-6">
      <div style={{ height: '1px', background: 'var(--ps-divider)' }} />
    </div>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div style={{ background: 'var(--ps-page-bg)', minHeight: '100vh' }}>
      <div className="flex flex-col min-h-screen">
        <NavBar />
        <HeroSection />
      </div>
      <SectionDivider />
      <FeaturesSection />
      <SectionDivider />
      <BenchmarksSection />
      <FinalCTASection />
      <Footer />
    </div>
  );
}
