import { useEffect, useRef, type CSSProperties } from 'react';
import {
  BarChart3, Globe, Scale, History, Zap, Layers,
  Network, Sparkles, ShieldCheck,
} from 'lucide-react';

const FEATURES = [
  {
    icon: <BarChart3 className="w-5 h-5" />, tag: 'Core',
    title: 'Comprehensive Performance Audit',
    description: "Run deep scans using industry-standard engines to get a full breakdown of your application's speed. We simplify complex web metrics into an understandable performance score.",
    bullets: ['Core Web Vitals (LCP, FID, CLS) tracking', 'Real-world user experience simulation', 'Mobile and desktop environment testing', 'Detailed "Time to Interactive" analysis'],
  },
  {
    icon: <Globe className="w-5 h-5" />, tag: 'Market',
    title: 'Competitive Benchmarking',
    description: 'See how you stack up against the competition. Run side-by-side audits against any live URL to compare your speed, SEO, and quality scores with industry rivals.',
    bullets: ['Direct competitor URL comparison', 'Industry-standard performance ranking', 'Market-share performance analysis', 'Identify competitive advantages and gaps'],
  },
  {
    icon: <Scale className="w-5 h-5" />, tag: 'Comparison',
    title: 'Internal Audit Compare',
    description: 'Stop wondering if your latest deployment actually improved things. Select any two of your own audits to see a direct comparison of metrics and highlight drifts.',
    bullets: ['Visual "Diff" of performance scores', 'Metric-by-metric delta tracking (+/-)', 'Side-by-side filmstrip comparison', 'Asset-level regression detection'],
  },
  {
    icon: <History className="w-5 h-5" />, tag: 'Timeline',
    title: 'Regression & History Tracking',
    description: 'Monitor how every code change affects your performance over time. By keeping a permanent log of every audit, we help you detect speed drops instantly.',
    bullets: ['Unlimited historical audit storage', 'Visual trend mapping over time', 'Snapshot archiving for every release', 'Automatic alerts on performance degradation'],
  },
  {
    icon: <Zap className="w-5 h-5" />, tag: 'Real-time',
    title: 'Live Updates & Synchronization',
    description: 'No more refreshing. Our system uses real-time technology to sync audit results across your entire dashboard the moment they are completed.',
    bullets: ['Instant real-time result streaming', 'Cross-tab data synchronization', 'Live status monitoring for active audits', 'Zero-latency reporting dashboard'],
  },
  {
    icon: <Layers className="w-5 h-5" />, tag: 'Visual',
    title: 'CLS Visualizer & Filmstrip',
    description: 'See exactly what your users see. Our visualizer highlights layout shifts frame-by-frame, pinpointing elements that cause frustrating visual instability.',
    bullets: ['Frame-by-frame loading playback', 'Heatmap overlays on unstable elements', 'Visual "culprit" detection for shifts', 'User experience stability scoring'],
  },
  {
    icon: <Network className="w-5 h-5" />, tag: 'Assets',
    title: 'Network & Resource Analysis',
    description: 'Map out every request your application makes. Identify heavy images, slow third-party scripts, and resources that delay your page load.',
    bullets: ['Full request waterfall visualization', 'Third-party script impact analysis', 'Asset size and compression auditing', 'Identification of blocking resources'],
  },
  {
    icon: <Sparkles className="w-5 h-5" />, tag: 'AI-Driven',
    title: 'AI-Powered Smart Fixes',
    description: 'Get expert-level solutions instantly. Our AI analyzes failing audits to provide technical root-cause explanations and actionable code optimizations.',
    bullets: ['AI-generated root cause analysis', 'Copy-paste ready code suggestions', 'Prioritized fix roadmaps for LCP/CLS', 'Context-aware performance advice'],
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />, tag: 'Quality',
    title: 'Accessibility & SEO Audits',
    description: 'Ensure your site is inclusive and visible. We audit your application against modern accessibility standards and search engine best practices.',
    bullets: ['A11y (Accessibility) compliance checks', 'SEO structure and meta-data validation', 'Best-practice industry health scores', 'Comprehensive brand quality reporting'],
  },
] as const;

function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export function FeaturesSection() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('[data-feat]');
    if (!cards) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const delay = reduced ? 0 : Number(el.dataset.col ?? 0) * 60;
        setTimeout(() => { el.dataset.visible = 'true'; }, delay);
        io.unobserve(el);
      });
    }, { threshold: 0.1 });

    cards.forEach(c => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <section id="features" className="border-y border-[var(--ld-border)] bg-[var(--ld-bg-2)] py-[clamp(72px,11vw,140px)]">
      <div className="ld-wrap">

        {/* Header */}
        <div className="reveal text-center max-w-[720px] mx-auto mb-[clamp(44px,6vw,70px)]">
          <span className="ld-eyebrow block mb-4">Features</span>
          <h2 className="ld-h-section text-[var(--ld-text)]">Everything you need to ship fast, stable pages.</h2>
          <p className="ld-lead mt-[18px] mx-auto">
            From raw Lighthouse scores to frame-level CLS inspection, network waterfalls,
            and instant fixes — one tool, complete visibility.
          </p>
        </div>

        {/* Grid */}
        <div ref={gridRef} className="grid grid-cols-1 min-[760px]:grid-cols-2 min-[980px]:grid-cols-3 gap-[18px]">
          {FEATURES.map(({ icon, tag, title, description, bullets }, idx) => (
            <div
              key={title}
              data-feat
              data-col={idx % 3}
              onMouseMove={onMouseMove}
              style={{ '--mx': '50%', '--my': '50%' } as CSSProperties}
              className={[
                // layout
                'group relative overflow-hidden isolate p-[26px] rounded-2xl cursor-default',
                'border border-[var(--ld-border)] bg-[var(--ld-surface)]',
                // entrance — opacity only, driven by data-visible attribute
                'opacity-0 transition-[opacity,transform,border-color,box-shadow] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]',
                'data-[visible=true]:opacity-100',
                // hover
                'hover:border-[var(--ld-accent-line)] hover:-translate-y-1',
                'hover:shadow-[0_0_0_1px_var(--ld-accent-soft),0_26px_56px_-30px_rgba(20,192,138,.5)]',
                // ::before cursor spotlight
                'before:content-[""] before:absolute before:inset-0 before:-z-10 before:pointer-events-none',
                'before:bg-[radial-gradient(420px_circle_at_var(--mx)_var(--my),var(--ld-accent-soft),transparent_60%)]',
                'before:opacity-0 before:transition-opacity before:duration-300',
                'hover:before:opacity-100',
                // ::after top accent bar
                'after:content-[""] after:absolute after:inset-x-0 after:top-0 after:h-[2px] after:z-10 after:pointer-events-none',
                'after:bg-[image:var(--ld-grad)] after:scale-x-0 after:origin-left',
                'after:transition-transform after:duration-[400ms] after:ease-[cubic-bezier(.4,.8,.3,1)]',
                'hover:after:scale-x-100',
                // reduced motion
                'motion-reduce:opacity-100 motion-reduce:transition-none',
              ].join(' ')}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-5">
                {/* Icon tile */}
                <div className={[
                  'w-[46px] h-[46px] rounded-[13px] border border-[var(--ld-border-strong)] bg-[var(--ld-surface-2)]',
                  'text-[var(--ld-accent)] grid place-items-center shrink-0',
                  'transition-[background,border-color,box-shadow,transform,color] duration-[350ms] ease-[cubic-bezier(.34,1.56,.5,1)]',
                  'group-hover:bg-[image:var(--ld-grad)] group-hover:text-[#04130d]',
                  'group-hover:border-transparent group-hover:shadow-[var(--ld-glow)] group-hover:-translate-y-0.5',
                ].join(' ')}>
                  <span className="transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.56,.5,1)] group-hover:scale-[1.06]">
                    {icon}
                  </span>
                </div>

                {/* Tag */}
                <span className={[
                  'font-mono text-[10.5px] tracking-[.06em] px-[10px] py-1 rounded-[7px]',
                  'border border-[var(--ld-border)] text-[var(--ld-text-3)]',
                  'transition-[color,border-color,background] duration-200',
                  'group-hover:text-[var(--ld-accent-2)] group-hover:border-[var(--ld-accent-line)] group-hover:bg-[var(--ld-accent-soft)]',
                ].join(' ')}>
                  {tag}
                </span>
              </div>

              <h3 className="text-[19px] font-bold text-[var(--ld-text)] mb-[10px]">{title}</h3>
              <p className="text-[var(--ld-text-2)] text-[14.5px] mb-[18px]">{description}</p>

              {/* Bullets */}
              <ul className="grid gap-[9px] list-none p-0 m-0">
                {bullets.map(b => (
                  <li key={b} className="flex items-start gap-[9px] text-[13.5px]">
                    <span className="w-[6px] h-[6px] rounded-full mt-[7px] shrink-0 block bg-[var(--ld-accent-line)] transition-[background,box-shadow] duration-200 group-hover:bg-[var(--ld-accent)] group-hover:shadow-[0_0_0_3px_var(--ld-accent-soft)]" />
                    <span className="text-[var(--ld-text-2)] transition-colors duration-200 group-hover:text-[var(--ld-text)]">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
