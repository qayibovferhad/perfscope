import { nodeConfig } from '../../eslint.config.base.js'

// Plain JavaScript that runs on a GitHub runner — no bundler, no TypeScript.
export default nodeConfig({ files: ['run.mjs', 'src/**/*.js'] })
