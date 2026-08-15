import globals from 'globals'
import { nodeConfig } from '../eslint.config.base.js'

// Probes run in Node but evaluate code inside a page, so they legitimately mention
// browser globals and the extension's `chrome` API in strings passed to puppeteer.
export default nodeConfig({
  files: ['**/*.mjs'],
  globals: { ...globals.browser, chrome: 'readonly' },
})
