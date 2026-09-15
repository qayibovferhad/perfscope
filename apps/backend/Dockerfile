# syntax=docker/dockerfile:1
#
# PerfScope backend — Express + Socket.io + Lighthouse.
#
# Build from the REPO ROOT, not this directory:
#   docker build -f apps/backend/Dockerfile -t perfscope-backend .
# The workspace dependency on @perfscope/shared is a symlink into packages/shared, so a
# context rooted at apps/backend cannot resolve it.
#
# The one thing that makes this image different from any other Node service: it needs a
# real browser. Chromium comes from Debian rather than from Puppeteer's own download —
# apt resolves the ~60 shared libraries a headless Chrome needs, which the bare binary
# does not, and it keeps the image multi-arch. `PUPPETEER_SKIP_DOWNLOAD` then stops the
# npm install from fetching a second copy (~180 MB) that nothing would launch, and
# `PUPPETEER_EXECUTABLE_PATH` is what every `puppeteer.launch()` in the codebase resolves
# — the same mechanism CI already uses with `setup-chrome`.

# ─── base ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable
WORKDIR /app

# ─── deps ────────────────────────────────────────────────────────────────────
# Every workspace manifest is copied, not just the two this image builds: a filtered
# `--frozen-lockfile` install still checks the lockfile against the *whole* workspace and
# reports it out of date when a member's package.json is missing.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/backend/package.json            apps/backend/
COPY apps/web-dashboard/package.json      apps/web-dashboard/
COPY apps/chrome-extension/package.json   apps/chrome-extension/
COPY packages/shared/package.json         packages/shared/
COPY packages/cli/package.json            packages/cli/
COPY packages/action/package.json         packages/action/
COPY e2e/package.json                     e2e/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @perfscope/backend...

# ─── build ───────────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/backend    apps/backend
# `--filter pkg...` includes the dependencies, and `pnpm run -r` is topological, so shared
# is built (tsup) before the backend's `tsc` needs its .d.ts files.
RUN pnpm --filter @perfscope/backend... run build
# Drop the dev dependencies in place — tsc, tsx, vitest and tsup are ~200 MB of the tree
# and nothing in the running image calls them. The built dist/ directories survive this.
# `confirmModulesPurge=false`: dropping the dev dependencies means recreating
# node_modules, and pnpm refuses to remove a modules directory unattended without it —
# the error names a TTY, not a flag, and reads like a build-environment problem.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --config.confirmModulesPurge=false \
      --filter @perfscope/backend...

# ─── runtime ─────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
# Stamped by the release workflow with the tag or `main-<sha>`; `/health` reports it, which
# is how a deploy is confirmed from outside the host.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION \
    NODE_ENV=production \
    PORT=3101 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    HOME=/home/node
RUN apt-get update && apt-get install --no-install-recommends -y \
      chromium \
      fonts-liberation \
      fonts-noto-color-emoji \
      ca-certificates \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build --chown=node:node /app /app

# Chrome writes profiles and crash dumps under HOME, and a headless audit that cannot
# write a profile directory fails with a launch error that looks nothing like a
# permissions problem.
RUN mkdir -p /home/node/.cache && chown -R node:node /home/node
USER node

EXPOSE 3101
# Every audit spawns Chrome processes; PID 1 has to reap them or the container fills with
# zombies over a few hundred runs. lib/chromeReaper.ts kills the browsers it knows about,
# but an orphan from a crashed worker has no parent left to wait on it.
ENTRYPOINT ["dumb-init", "--"]
# `node -e` rather than curl/wget: neither is installed, and adding one for a healthcheck
# is a package more than the image needs.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3101)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
WORKDIR /app/apps/backend
CMD ["node", "dist/index.js"]
