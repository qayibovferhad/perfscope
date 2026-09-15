# Publishing and deploying

Two files do this: `.github/workflows/release.yml` builds and pushes the images,
`docker-compose.deploy.yml` is what runs on a server. Local container work is
[DOCKER.md](DOCKER.md); this is the pipeline.

## What gets published, and when

| Trigger | Tags pushed |
|---|---|
| push to `main` | `main`, `main-<sha>` |
| tag `v1.2.3` | `1.2.3`, `1.2`, `latest` |
| manual run | whatever the checked-out ref implies |

```
ghcr.io/<owner>/perfscope-backend:<tag>
ghcr.io/<owner>/perfscope-web:<tag>
```

GHCR rather than Docker Hub: the images belong to the repository, `GITHUB_TOKEN` can
already push to it, and nobody has to hold a second account's credentials. The packages
inherit the repository's visibility — a private repo publishes private images, and a host
pulling them needs a token (`docker login ghcr.io -u <user> -p <PAT with read:packages>`).

`linux/amd64` only. arm64 would be emulated on a GitHub runner, where apt-installing
Chromium under QEMU takes the better part of an hour, and no known target runs arm; the
comment in the workflow says what to add when one does.

**Every image is stamped.** `APP_VERSION` (the tag, or `main-<sha>`) is baked in as a build
arg and reported by `/health`:

```
$ curl -s https://perfscope.example.com/health
{"status":"ok","uptime":20,"database":"up","version":"main-abc1234"}
```

That field is the only way to tell a deploy from a restart — the old container answers 200
just as happily — which is why the deploy job polls for it rather than for a 200.

## Deploying by hand

The host needs Docker, this one compose file, and a `.env.docker` beside it. No checkout,
no Node, no pnpm.

```bash
scp docker-compose.deploy.yml .env.docker scripts/mongo-backup.sh you@host:/opt/perfscope/
ssh you@host
cd /opt/perfscope
export IMAGE_REPO=ghcr.io/<owner>/perfscope
export IMAGE_TAG=v1.0.0                       # or main-<sha>
docker compose --env-file .env.docker -f docker-compose.deploy.yml pull
docker compose --env-file .env.docker -f docker-compose.deploy.yml up -d
curl -s localhost:8080/health
```

`IMAGE_TAG` has no default on purpose: a deploy has to say which build it is deploying, and
`latest` quietly reinstalling last month's image is the failure that avoids. `PUBLIC_URL`,
`JWT_SECRET` and `IMAGE_REPO` are required too — compose stops with a sentence naming each.

Behind TLS, set `WEB_BIND=127.0.0.1` and point the host's nginx, Caddy or Traefik at
`127.0.0.1:8080`; the container speaks plain HTTP and reads `X-Forwarded-*`. Published on
`0.0.0.0` (the default) it serves HTTP with no certificate, which is fine for a private
network and not for the internet.

## Deploying automatically

The `deploy` job in `release.yml` runs the three commands above over SSH. It does nothing
at all until a host is configured — a deploy job that fails on every push because nobody
provisioned a server is worse than one that says it has nothing to do.

| Setting | Kind | Purpose |
|---|---|---|
| `DEPLOY_HOST` | variable | the switch: unset means skip |
| `DEPLOY_SSH_KEY` | secret | private key for that user |
| `DEPLOY_USER` | variable | default `deploy` |
| `DEPLOY_PATH` | variable | default `/opt/perfscope` |
| `PUBLIC_URL` | variable | where the version check polls `/health` |

The host keeps its own `.env.docker`; only the image tag travels. The job ends by polling
`/health` until `version` matches the tag it just pushed, and fails if it never does.

## What is still missing

- **TLS and a domain** — the host's reverse proxy, not this repo's business, but nothing
  here has been run against one yet.
- **Off-host backups.** There is a daily dump into a volume on the same disk as the data
  ([BACKUP.md](BACKUP.md)); copying it somewhere else is still the operator's job.
- **Metrics.** Logs and `/health` are all there is — no counter for audits run or queue
  depth ([OBSERVABILITY.md](OBSERVABILITY.md)).
- **A rollback command.** `IMAGE_TAG=<previous> … up -d` is the whole procedure and it
  works, but it is not written down anywhere a person under pressure would find it. It is
  now: that is the rollback.
