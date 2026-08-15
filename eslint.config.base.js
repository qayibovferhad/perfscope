/**
 * Shared ESLint base for the workspaces that are not the dashboard.
 *
 * The dashboard has its own config because it carries React and the FSD layer rules; this
 * is the plain-TypeScript baseline for everything else. It lives at the root so that its
 * own imports resolve from the root `node_modules` — pnpm does not hoist, so a per-workspace
 * config would otherwise need its own copy of every plugin.
 *
 * Deliberately small. The point is to have *a* gate on five workspaces that had none, not
 * to relitigate style in code nobody is about to rewrite.
 */
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/** @param {{ files?: string[], ignores?: string[], globals?: Record<string, boolean> }} opts */
export function nodeConfig(opts = {}) {
  return defineConfig([
    globalIgnores(['dist', '.output', '.wxt', 'node_modules', ...(opts.ignores ?? [])]),
    {
      files: opts.files ?? ['**/*.ts'],
      extends: [js.configs.recommended, tseslint.configs.recommended],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: { ...globals.node, ...(opts.globals ?? {}) },
      },
      rules: {
        // `_`-prefixed parameters are how this codebase marks a deliberately unused
        // argument — an Express handler that needs `next` in position, say.
        '@typescript-eslint/no-unused-vars': ['error', {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        }],
      },
    },
  ])
}
