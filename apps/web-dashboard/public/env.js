// Placeholder so the dev server and a plain `vite preview` do not 404 on it.
//
// The Docker image OVERWRITES this file at container start with the deployment's own
// values (apps/web-dashboard/docker/40-runtime-env.sh). Leaving the keys unset here is what
// makes shared/config/runtimeEnv.ts fall through to the VITE_* build vars on a laptop.
window.__PERFSCOPE_ENV__ = {};
