/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{html,ts,tsx}',
    './assets/**/*.css',
  ],
  theme: {
    extend: {
      colors: {
        /* --ld-* design tokens from @perfscope/shared/tokens.css */
        'ld-bg':            'var(--ld-bg)',
        'ld-bg-2':          'var(--ld-bg-2)',
        'ld-surface':       'var(--ld-surface)',
        'ld-surface-2':     'var(--ld-surface-2)',
        'ld-surface-hover': 'var(--ld-surface-hover)',
        'ld-border':        'var(--ld-border)',
        'ld-border-strong': 'var(--ld-border-strong)',
        'ld-text':          'var(--ld-text)',
        'ld-text-2':        'var(--ld-text-2)',
        'ld-text-3':        'var(--ld-text-3)',
        'ld-accent':        'var(--ld-accent)',
        'ld-accent-2':      'var(--ld-accent-2)',
        'ld-accent-soft':   'var(--ld-accent-soft)',
        'ld-accent-line':   'var(--ld-accent-line)',
        'ld-amber':         'var(--ld-amber)',
        'ld-rose':          'var(--ld-rose)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
