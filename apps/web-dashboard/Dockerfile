# syntax=docker/dockerfile:1
#
# PerfScope dashboard — Vite build served by nginx, which also proxies the API and the
# socket to the backend so the bundle needs no origin of its own.
#
# Build from the REPO ROOT:
#   docker build -f apps/web-dashboard/Dockerfile -t perfscope-web .
#
# There are deliberately no VITE_* build arguments. Everything a deployment decides is
# read at runtime from /env.js — see docker/40-runtime-env.sh and
# src/shared/config/runtimeEnv.ts. Baking them in would mean an image per install.

# ─── deps ────────────────────────────────────────────────────────────────────
# Every workspace manifest, for the same reason as the backend image: a filtered
# `--frozen-lockfile` install validates the lockfile against the whole workspace.
FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/backend/package.json            apps/backend/
COPY apps/web-dashboard/package.json      apps/web-dashboard/
COPY apps/chrome-extension/package.json   apps/chrome-extension/
COPY packages/shared/package.json         packages/shared/
COPY packages/cli/package.json            packages/cli/
COPY packages/action/package.json         packages/action/
COPY e2e/package.json                     e2e/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @perfscope/web-dashboard...

# ─── build ───────────────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json eslint.config.base.js ./
COPY packages/shared      packages/shared
COPY apps/web-dashboard   apps/web-dashboard
# The dashboard's build is `tsc -b && vite build`, and the project reference resolves to
# packages/shared/dist — `--filter pkg...` builds shared first (pnpm run -r is topological),
# so those .d.ts files exist by the time tsc looks for them.
RUN pnpm --filter @perfscope/web-dashboard... run build

# ─── runtime ─────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY apps/web-dashboard/docker/nginx.conf         /etc/nginx/conf.d/default.conf
COPY apps/web-dashboard/docker/proxy-headers.inc  /etc/nginx/conf.d/proxy-headers.inc
COPY apps/web-dashboard/docker/40-runtime-env.sh  /docker-entrypoint.d/40-runtime-env.sh
COPY --from=build /app/apps/web-dashboard/dist    /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/_healthz >/dev/null 2>&1 || exit 1
# No ENTRYPOINT of our own: the nginx image's entrypoint runs /docker-entrypoint.d/* and
# then starts the server, so 40-runtime-env.sh writes env.js on every container start.
CMD ["nginx", "-g", "daemon off;"]
