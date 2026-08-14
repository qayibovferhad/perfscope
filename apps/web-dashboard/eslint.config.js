import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// FSD layer enforcement: imports flow strictly downward
// app → pages → widgets → features → entities → shared.
// Same-slice imports must be relative; cross-slice via '@/<layer>/<slice>'.
const banned = (layers, extra = []) => ({
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        ...layers.map((l) => ({
          group: [`@/${l}/*`, `@/${l}`],
          message: `FSD: this layer must not import from '${l}' (imports flow downward only).`,
        })),
        ...extra,
      ],
    }],
  },
})

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Advisory findings from the compiler-powered react-hooks plugin stay visible
      // as warnings; errors are reserved for real defects and FSD boundary breaks.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  { files: ['src/shared/**/*.{ts,tsx}'],   ...banned(['entities', 'features', 'widgets', 'pages', 'app']) },
  { files: ['src/entities/**/*.{ts,tsx}'], ...banned(['features', 'widgets', 'pages', 'app']) },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    ...banned(['widgets', 'pages', 'app'], [{
      // Cross-feature imports are banned; auth-audit's public barrel is the one
      // sanctioned exception (compare + websites embed its modals).
      group: ['@/features/*', '!@/features/auth-audit'],
      message: 'FSD: no cross-feature imports (use relative paths inside a slice; auth-audit barrel is the only exception).',
    }]),
  },
  { files: ['src/widgets/**/*.{ts,tsx}'],  ...banned(['pages', 'app'], [{
      // Consumed through the public barrel only — before this pattern existed, 80 deep
      // imports had accumulated because the layer rules said nothing about slice internals.
      group: ['@/features/*/**'],
      message: "FSD: import from the feature's barrel ('@/features/<name>'), not its internals.",
    }, {
      group: ['@/widgets/*', '@/widgets'],
      message: 'FSD: widgets must not import other widgets.',
    }]),
  },
  { files: ['src/pages/**/*.{ts,tsx}'],    ...banned(['app'], [{
      // Consumed through the public barrel only — before this pattern existed, 80 deep
      // imports had accumulated because the layer rules said nothing about slice internals.
      group: ['@/features/*/**'],
      message: "FSD: import from the feature's barrel ('@/features/<name>'), not its internals.",
    }, {
      group: ['@/pages/*', '@/pages'],
      message: 'FSD: pages must not import other pages.',
    }]),
  },
  // app is the top layer, free to import everything — but still through public barrels.
  { files: ['src/app/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{
      // Consumed through the public barrel only — before this pattern existed, 80 deep
      // imports had accumulated because the layer rules said nothing about slice internals.
      group: ['@/features/*/**'],
      message: "FSD: import from the feature's barrel ('@/features/<name>'), not its internals.",
    }, ] }] },
  },
])
