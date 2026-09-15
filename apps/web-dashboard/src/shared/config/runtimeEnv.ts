/**
 * Configuration the *deployment* decides, read at runtime rather than at build time.
 *
 * Vite bakes `import.meta.env.VITE_*` into the bundle, which is fine for a laptop and
 * wrong for a container image: the backend URL and the Google client id belong to the
 * install, not to the build, and an image that carries one install's values has to be
 * rebuilt to serve another. So the nginx image writes `/env.js` at container start from
 * its environment, and this module reads that first:
 *
 *   window.__PERFSCOPE_ENV__ → import.meta.env.VITE_* → sensible default
 *
 * `env.js` is a plain script in <head>, so it has run before this module is evaluated.
 * An empty string counts as unset — an unconfigured container writes `BACKEND_URL: ""`
 * and must fall through to the default, not point the socket at nothing.
 */

declare global {
  interface Window {
    __PERFSCOPE_ENV__?: Record<string, string | undefined>;
  }
}

function fromWindow(key: string): string | undefined {
  const value = window.__PERFSCOPE_ENV__?.[key];
  return value && value.trim() ? value.trim() : undefined;
}

function fromBuild(value: string | undefined): string | undefined {
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * Where the API and the socket live.
 *
 * The default differs by mode on purpose. In development the dashboard is on :5173 and the
 * backend on :3101, and Vite's proxy only covers `/api` — the socket needs the absolute
 * URL. In a built deployment nginx proxies `/api`, `/socket.io` and `/rum.js` to the
 * backend from the dashboard's own origin, so same-origin is both correct and the one
 * value that never needs configuring.
 */
export const backendUrl = (
  fromWindow('BACKEND_URL') ??
  fromBuild(import.meta.env.VITE_BACKEND_URL) ??
  (import.meta.env.DEV ? 'http://localhost:3101' : window.location.origin)
).replace(/\/$/, '');

/** Empty means Google sign-in is hidden — see features/auth/lib/googleAuth.ts. */
export const googleClientId =
  fromWindow('GOOGLE_CLIENT_ID') ?? fromBuild(import.meta.env.VITE_GOOGLE_CLIENT_ID) ?? '';
