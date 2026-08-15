import { nodeConfig } from '../../eslint.config.base.js'

// Plain JavaScript, published to npm on its own — no TypeScript to check here.
export default nodeConfig({ files: ['bin/**/*.js', 'src/**/*.js'] })
