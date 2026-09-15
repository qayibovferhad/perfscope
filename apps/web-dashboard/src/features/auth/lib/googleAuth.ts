/**
 * Whether Google sign-in can be offered at all.
 *
 * Without a configured client id the provider is never mounted, and `useGoogleLogin`
 * throws outside a provider — taking the whole login page with it. So pages gate on this
 * flag rather than rendering the button and hoping.
 *
 * Its own module because a component file that also exports a constant cannot fast-refresh.
 */
import { googleClientId } from '@/shared/config/runtimeEnv';

export const googleAuthEnabled = Boolean(googleClientId);
