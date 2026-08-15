import { nodeConfig } from '../../eslint.config.base.js'

// `probes/` is deliberately included: they are the closest thing this package has to tests,
// and a probe that stops compiling is a probe nobody runs.
export default nodeConfig({ files: ['src/**/*.ts', 'probes/**/*.mts'] })
