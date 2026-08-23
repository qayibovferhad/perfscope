/**
 * Public API of the notifications feature — the bell in the shell.
 *
 * Everything the outside world may use is exported here; ESLint bans reaching past
 * this file. Internals can move freely as long as these names keep resolving.
 */
export { NotificationBell } from './ui/NotificationBell';
export { useNotifications } from './model/useNotifications';
