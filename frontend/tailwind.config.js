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
        /* Shadcn semantic tokens */
        background: 'hsl(var(--background))',
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

        /* PerfScope semantic palette — usable as text-ps-accent, bg-ps-accent, etc. */
        'ps-accent':     'var(--ps-accent)',
        'ps-amber':      'var(--ps-amber)',
        'ps-healthy':    'var(--ps-healthy)',
        'ps-regression': 'var(--ps-regression)',
        'ps-page':       'var(--ps-page-bg)',
      },
      fontFamily: {
        /* Heading & UI: Inter */
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
        /* Data, metrics, code: JetBrains Mono */
        mono:    ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        /* Neon glow helpers: shadow-glow-accent etc. */
        'glow-accent': '0 0 32px var(--ps-accent-glow)',
        'glow-accent-lg': '0 0 48px var(--ps-accent-glow-lg)',
        'glow-reg':    '0 0 20px var(--ps-reg-glow)',
        'glow-ok':     '0 0 20px var(--ps-healthy-glow)',
        'glow-amber':  '0 0 20px var(--ps-amber-glow)',
      },
    },
  },
  plugins: [],
};
