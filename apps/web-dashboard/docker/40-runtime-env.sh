#!/bin/sh
# Write the deployment's configuration into the static bundle, before nginx starts.
#
# Dropped into /docker-entrypoint.d/, which the nginx image's own entrypoint runs in name
# order and then execs nginx — so this adds a step rather than replacing that machinery
# (its template rendering and permission fixes still run).
#
# This is what makes one image serve any install: the bundle reads window.__PERFSCOPE_ENV__
# (src/shared/config/runtimeEnv.ts), so the backend URL and the Google client id are
# container environment, not build arguments.
#
# Both are optional. Empty BACKEND_URL means same-origin, which is the normal case behind
# this container's own nginx proxy; empty GOOGLE_CLIENT_ID hides Google sign-in.
set -eu

ENV_FILE=/usr/share/nginx/html/env.js

# JSON string values: a stray quote or backslash in an env var would otherwise produce a
# file that fails to parse and takes the whole app down with a blank page.
escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

cat > "$ENV_FILE" <<JS
// Generated at container start by docker/40-runtime-env.sh — do not edit.
window.__PERFSCOPE_ENV__ = {
  BACKEND_URL: "$(escape "${BACKEND_URL:-}")",
  GOOGLE_CLIENT_ID: "$(escape "${GOOGLE_CLIENT_ID:-}")"
};
JS

echo "[entrypoint] env.js written (BACKEND_URL='${BACKEND_URL:-same-origin}', google sign-in $([ -n "${GOOGLE_CLIENT_ID:-}" ] && echo enabled || echo disabled))"