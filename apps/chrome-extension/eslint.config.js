import globals from 'globals'
import { nodeConfig } from '../../eslint.config.base.js'

// WXT auto-imports `browser`, `defineBackground` and friends — they are real globals here,
// not undeclared variables.
export default nodeConfig({
  files: ['entrypoints/**/*.{ts,tsx}', 'lib/**/*.ts'],
  globals: {
    ...globals.browser,
    browser: 'readonly', chrome: 'readonly',
    defineBackground: 'readonly', defineContentScript: 'readonly', defineUnlistedScript: 'readonly',
  },
})
