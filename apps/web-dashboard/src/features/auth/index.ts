/**
 * Public API of the auth feature. Sign-in, the session store, and the route guard.
 *
 * Everything the outside world may use is exported here; ESLint bans reaching past
 * this file. Internals can move freely as long as these names keep resolving.
 */
export { useAuthStore } from './model/authStore';
export { signOut } from './model/signOut';
export { GoogleButton } from './ui/GoogleButton';
export { googleAuthEnabled } from './lib/googleAuth';
export { ProtectedRoute } from './ui/ProtectedRoute';
