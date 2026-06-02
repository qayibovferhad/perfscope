/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        /* ── Shadcn semantic tokens (kept for Shadcn primitives) ──────────── */
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',

        /* ── PerfScope Design System ─────────────────────────────────────── */
        /* Surfaces & dividers */
        'ps-page':             'var(--ps-page-bg)',
        'ps-surface':          'var(--ps-panel-bg)',
        'ps-surface-border':   'var(--ps-panel-border)',
        'ps-divider':          'var(--ps-divider)',
        'ps-nav':              'var(--ps-nav-bg)',
        'ps-glass':            'var(--ps-glass-bg)',
        'ps-glass-border':     'var(--ps-glass-border)',
        'ps-subtle':           'var(--ps-subtle-bg)',
        'ps-subtle-border':    'var(--ps-subtle-border)',

        /* Text scale */
        'ps-heading':    'var(--ps-text-heading)',
        'ps-body':       'var(--ps-text-primary)',
        'ps-secondary':  'var(--ps-text-secondary)',
        'ps-muted':      'var(--ps-text-muted)',
        'ps-faint':      'var(--ps-text-faint)',

        /* Accent — violet */
        'ps-accent':         'var(--ps-accent)',
        'ps-accent-muted':   'var(--ps-accent-muted)',
        'ps-accent-hover':   'var(--ps-accent-hover)',
        'ps-accent-border':  'var(--ps-accent-border)',

        /* Amber */
        'ps-amber':          'var(--ps-amber)',
        'ps-amber-muted':    'var(--ps-amber-muted)',
        'ps-amber-border':   'var(--ps-amber-border)',

        /* Healthy / success */
        'ps-healthy':         'var(--ps-healthy)',
        'ps-healthy-muted':   'var(--ps-healthy-muted)',
        'ps-healthy-border':  'var(--ps-healthy-border)',

        /* Regression / danger */
        'ps-regression':      'var(--ps-regression)',
        'ps-reg-muted':       'var(--ps-reg-muted)',
        'ps-reg-border':      'var(--ps-reg-border)',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        /* Brand gradient — single source of truth */
        'ps-brand': 'linear-gradient(135deg, #4f46e5, #8B5CF6)',
      },
      boxShadow: {
        'glow-accent':    '0 0 16px var(--ps-accent-glow)',
        'glow-accent-lg': '0 0 32px var(--ps-accent-glow-lg)',
        'glow-reg':       '0 0 16px var(--ps-reg-glow)',
        'glow-ok':        '0 0 16px var(--ps-healthy-glow)',
        'glow-amber':     '0 0 16px var(--ps-amber-glow)',
      },
    },
  },
  plugins: [],
};
