/**
 * Public API of the flows feature — measuring a page after it has loaded.
 *
 * Everything the outside world may use is exported here; ESLint bans reaching past this
 * file from `app`, `pages` and `widgets`.
 */
export { useFlows, useFlowRuns, type FlowInput } from './model/useFlows';
export { useFlowRun } from './model/useFlowRun';
export { FlowEditorModal } from './ui/FlowEditorModal';
export { FlowRunReport } from './ui/FlowRunReport';
export { describeSteps } from './lib';
