/**
 * Public API of the extension feature. Chrome-extension connection status.
 *
 * Everything the outside world may use is exported here; ESLint bans reaching past
 * this file. Internals can move freely as long as these names keep resolving.
 */
export { useExtensionConnected } from './model/useExtensionConnected';
