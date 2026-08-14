/**
 * Public API of the automation feature. The audit timetable — schedule state and helpers.
 *
 * Everything the outside world may use is exported here; ESLint bans reaching past
 * this file. Internals can move freely as long as these names keep resolving.
 */
export { useAutomation } from './model/useAutomation';
export { fmtDate, nextRunAt } from './model/utils';
