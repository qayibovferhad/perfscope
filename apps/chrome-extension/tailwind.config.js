/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{html,ts,tsx}',
    './components/**/*.{ts,tsx}',
    './assets/**/*.css',
  ],
  theme: {
    extend: {
      colors: {
        'ps-accent': '#8B5CF6',
        'ps-accent-dim': 'rgba(139,92,246,0.15)',
        'ps-amber': '#F59E0B',
        'ps-healthy': '#10b981',
        'ps-danger': '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-violet': '0 0 16px rgba(139,92,246,0.45)',
        'glow-green': '0 0 10px rgba(16,185,129,0.45)',
        'glow-red': '0 0 10px rgba(239,68,68,0.45)',
        'glow-amber': '0 0 10px rgba(245,158,11,0.45)',
      },
    },
  },
  plugins: [],
}
