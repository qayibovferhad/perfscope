import {
  BarChart3, Globe, Scale, History, Zap, Layers,
  Network, Sparkles, ShieldCheck,
} from 'lucide-react';

export interface FeatureCardData {
  icon:        React.ReactNode;
  accentColor: string;
  glowColor:   string;
  title:       string;
  description: string;
  bullets:     string[];
  tag:         string;
}

export const FEATURES: FeatureCardData[] = [
  {
    icon: <BarChart3 className="w-5 h-5" />,
    accentColor: '#8b5cf6', glowColor: 'rgba(139,92,246,0.08)', tag: 'Core',
    title: 'Comprehensive Performance Audit',
    description: "Run deep scans using industry-standard engines to get a full breakdown of your application's speed. We simplify complex web metrics into an understandable performance score.",
    bullets: ['Core Web Vitals (LCP, FID, CLS) tracking', 'Real-world user experience simulation', 'Mobile and desktop environment testing', 'Detailed "Time to Interactive" analysis'],
  },
  {
    icon: <Globe className="w-5 h-5" />,
    accentColor: '#0ea5e9', glowColor: 'rgba(14,165,233,0.08)', tag: 'Market',
    title: 'Competitive Benchmarking',
    description: 'See how you stack up against the competition. Run side-by-side audits against any live URL to compare your speed, SEO, and quality scores with industry rivals.',
    bullets: ['Direct competitor URL comparison', 'Industry-standard performance ranking', 'Market-share performance analysis', 'Identify competitive advantages and gaps'],
  },
  {
    icon: <Scale className="w-5 h-5" />,
    accentColor: '#f43f5e', glowColor: 'rgba(244,63,94,0.08)', tag: 'Comparison',
    title: 'Internal Audit Compare',
    description: 'Stop wondering if your latest deployment actually improved things. Select any two of your own audits to see a direct comparison of metrics and highlight drifts.',
    bullets: ['Visual "Diff" of performance scores', 'Metric-by-metric delta tracking (+/-)', 'Side-by-side filmstrip comparison', 'Asset-level regression detection'],
  },
  {
    icon: <History className="w-5 h-5" />,
    accentColor: '#3b82f6', glowColor: 'rgba(59,130,246,0.08)', tag: 'Timeline',
    title: 'Regression & History Tracking',
    description: 'Monitor how every code change affects your performance over time. By keeping a permanent log of every audit, we help you detect speed drops instantly.',
    bullets: ['Unlimited historical audit storage', 'Visual trend mapping over time', 'Snapshot archiving for every release', 'Automatic alerts on performance degradation'],
  },
  {
    icon: <Zap className="w-5 h-5" />,
    accentColor: '#fbbf24', glowColor: 'rgba(251,191,36,0.08)', tag: 'Real-time',
    title: 'Live Updates & Synchronization',
    description: 'No more refreshing. Our system uses real-time technology to sync audit results across your entire dashboard the moment they are completed.',
    bullets: ['Instant real-time result streaming', 'Cross-tab data synchronization', 'Live status monitoring for active audits', 'Zero-latency reporting dashboard'],
  },
  {
    icon: <Layers className="w-5 h-5" />,
    accentColor: '#f59e0b', glowColor: 'rgba(245,158,11,0.08)', tag: 'Visual',
    title: 'CLS Visualizer & Filmstrip',
    description: 'See exactly what your users see. Our visualizer highlights layout shifts frame-by-frame, pinpointing elements that cause frustrating visual instability.',
    bullets: ['Frame-by-frame loading playback', 'Heatmap overlays on unstable elements', 'Visual "culprit" detection for shifts', 'User experience stability scoring'],
  },
  {
    icon: <Network className="w-5 h-5" />,
    accentColor: '#06b6d4', glowColor: 'rgba(6,182,212,0.08)', tag: 'Assets',
    title: 'Network & Resource Analysis',
    description: 'Map out every request your application makes. Identify heavy images, slow third-party scripts, and resources that delay your page load.',
    bullets: ['Full request waterfall visualization', 'Third-party script impact analysis', 'Asset size and compression auditing', 'Identification of blocking resources'],
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    accentColor: '#10b981', glowColor: 'rgba(16,185,129,0.08)', tag: 'AI-Driven',
    title: 'AI-Powered Smart Fixes',
    description: 'Get expert-level solutions instantly. Our AI analyzes failing audits to provide technical root-cause explanations and actionable code optimizations.',
    bullets: ['AI-generated root cause analysis', 'Copy-paste ready code suggestions', 'Prioritized fix roadmaps for LCP/CLS', 'Context-aware performance advice'],
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    accentColor: '#6366f1', glowColor: 'rgba(99,102,241,0.08)', tag: 'Quality',
    title: 'Accessibility & SEO Audits',
    description: 'Ensure your site is inclusive and visible. We audit your application against modern accessibility standards and search engine best practices.',
    bullets: ['A11y (Accessibility) compliance checks', 'SEO structure and meta-data validation', 'Best-practice industry health scores', 'Comprehensive brand quality reporting'],
  },
];
