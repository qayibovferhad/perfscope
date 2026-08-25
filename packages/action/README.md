# PerfScope GitHub Action

Audit a URL with Lighthouse on every pull request, fail the build when it breaks a
performance budget, and say so where the review is happening — one comment that keeps
itself up to date, plus a check run on the commit.

```yaml
name: Performance
on: pull_request

jobs:
  budget:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      checks: write          # the check run
      pull-requests: write   # the comment
    steps:
      - uses: qayibovferhad/perfscope/packages/action@main
        with:
          url: https://staging.example.com
          budget: performance=80,lcp=2500,cls=0.1
          refresh-token: ${{ secrets.PERFSCOPE_REFRESH_TOKEN }}
```

That is the whole setup. The audit runs on PerfScope's own infrastructure — the runner only
asks for it — so the numbers are comparable between runs rather than being whatever the
runner's CPU was doing that morning.

## What lands on the pull request

> ### ❌ PerfScope — budget failed (1 of 3)
>
> `https://staging.example.com` · mobile
>
> | Metric | Measured | Budget | Since last run | |
> | --- | --- | --- | --- | --- |
> | Performance | 61 | ≥ 80 | 🔴 −19 | **❌** |
> | LCP | 2.10s | ≤ 2.50s | 🟢 −300ms | ✅ |
> | CLS | 0.041 | ≤ 0.100 | | ✅ |
>
> > The hero image is the LCP element and ships 400KB unoptimised…

The **Since last run** column compares against the previous audit of the same URL, so a PR
that moved a number says by how much. The quoted paragraph is PerfScope's own diagnosis of
the run, present only when the account has AI enabled.

One comment per audited URL, edited in place on every push: a ten-push PR gets one comment,
not ten. Auditing several pages? Give each step its own `check-name` and they keep separate
comments, because the marker is keyed on the URL.

## Getting a token

`refresh-token` is what a pipeline should hold. Access tokens live thirty minutes, so one
pasted into a secret is stale by the next build; the CLI mints its own per run from the
refresh token. Run `perfscope login` locally and copy `refreshToken` out of the credentials
file that prints at the end (`perfscope whoami` shows where it lives).

`api-key` still works for a short-lived token, and is the right input when a job generates
one itself.

## Inputs

| Input | Default | |
| --- | --- | --- |
| `url` | — | **Required.** The page to audit. |
| `budget` | | `performance=80,lcp=2500` — omit to use `perfscope.json`. |
| `budget-file` | | Explicit path to a budget file. |
| `refresh-token` / `api-key` | | PerfScope credentials. |
| `api-url` / `app-url` | perfscope.com | Point at a self-hosted instance. |
| `warn-only` | `false` | Report a breach without failing the build (the check reports *neutral*, not red). |
| `tunnel` | `true` | Tunnel a `localhost` URL so the audit runner can reach it. |
| `share` | `false` | Mint a public report link for the comment. Off by default — the link makes the report readable by anyone who has it. |
| `comment` | `true` | Post/update the PR comment. |
| `check` | `true` | Create the check run. |
| `check-name` | `PerfScope budget` | Give each audited URL its own. |
| `github-token` | `${{ github.token }}` | Used for the comment and the check. |
| `cli-version` | `latest` | Version of `@perfscope/cli` to run. |
| `cli-path` | | Run a CLI from disk instead of npm. |

Outputs: `passed`, `performance`, `report-url`, `result-file` (the raw JSON, if a later step
wants the metrics).

## Things worth knowing before you wire it up

- **The CLI must be on npm.** The action runs `npx @perfscope/cli`, which is not published
  yet — until it is, use `cli-path` with a checkout of this repository (which is what this
  repo's own CI does).
- **A pull request from a fork gets a read-only token.** GitHub grants it deliberately, so
  the comment and the check are skipped with a line in the log rather than failing the
  build. The step summary still carries the numbers.
- **The audit decides the exit code, not this action.** 0 passed, 1 breached, 2 could not
  run — exactly what `perfscope ci` returns on its own. A comment that could not be posted
  never turns a passing build red.
- **A run that produced no result still speaks up.** An audit that timed out or could not
  reach the URL comments saying so; a green silence would be worse than a red build.
