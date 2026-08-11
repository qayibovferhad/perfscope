# @perfscope/cli

Command-line companion for [PerfScope](https://github.com/qayibovferhad/perfscope). Run a
Lighthouse audit from your terminal, or gate a build on a performance budget.

```bash
npx perfscope login                       # browser-based auth, token saved locally
npx perfscope --url https://example.com   # audit and print a report
npx perfscope ci  --url https://example.com --budget "performance=80"
```

## `perfscope ci` — fail the build on a slow page

Runs one audit, asserts a budget, and exits non-zero when the page misses it.

```bash
perfscope ci --url https://example.com --budget "performance=80,lcp=2500"
```

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Budget passed (or `--warn-only`) |
| `1` | Budget breached |
| `2` | The audit could not run — bad config, unreachable backend, failed page load |

`1` and `2` are deliberately distinct: a pipeline should be able to tell "the site is too
slow" from "we never measured it".

### Budget keys

`performance` is a floor — the score must stay **at or above** it. Everything else is a
ceiling the measurement must stay **at or below**.

| Key | Unit | Direction |
| --- | --- | --- |
| `performance` | score 0–100 | ≥ |
| `lcp`, `tbt`, `fcp`, `tti` | ms | ≤ |
| `cls` | unitless | ≤ |

A metric missing from a run is skipped rather than failed.

### Config file

Drop a `perfscope.json` (or `.perfscope.json`) next to your workflow and the thresholds
are picked up automatically:

```json
{
  "performance": 80,
  "lcp": 2500,
  "cls": 0.1
}
```

Thresholds may also sit under a `budget` key, so the file can carry other project config.
Point at a different file with `--budget-file ./budgets/home.json`.

Inline `--budget` flags override individual keys from the file, so a pipeline can tighten
one metric without maintaining a second file.

### Options

| Flag | Purpose |
| --- | --- |
| `-u, --url <url>` | Page to audit (required) |
| `-b, --budget <spec>` | Inline budget, `"performance=80,lcp=2500"` |
| `-f, --budget-file <path>` | Explicit budget JSON |
| `--api-url <url>` | PerfScope backend |
| `-k, --key <apiKey>` | API key; also read from `PERFSCOPE_API_KEY` |
| `-t, --timeout <ms>` | Audit timeout (default 180000) |
| `--json` | Machine-readable result on stdout |
| `--warn-only` | Report breaches, always exit 0 |
| `--no-tunnel` | Don't tunnel local URLs to a remote backend |

With `--json`, stdout carries **only** the JSON — progress and the summary go to stderr,
so `perfscope ci --json | jq` works.

```jsonc
{
  "url": "https://example.com/",
  "analysisId": "170edc6e-…",
  "formFactor": "desktop",
  "scores":  { "performance": 35, "accessibility": 67, … },
  "metrics": { "lcp": 7858.3, "tbt": 45.2, "cls": 0.664, … },
  "budget":  { "performance": 95 },
  "passed":  false,
  "failures": [{ "metric": "performance", "value": 35, "budget": 95, "kind": "floor" }]
}
```

## GitHub Actions

Breaches are emitted as `::error::` annotations, and a result table is appended to the
job summary.

```yaml
name: Performance budget
on: [pull_request]

jobs:
  perfscope:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }

      - name: Check performance budget
        run: npx perfscope ci --url https://staging.example.com
        env:
          PERFSCOPE_API_KEY: ${{ secrets.PERFSCOPE_API_KEY }}
          PERFSCOPE_API_URL: https://api.perfscope.com
```

Get the API key from `perfscope login && perfscope whoami`, or from the dashboard, and
store it as a repository secret.

To report without blocking a merge, add `--warn-only`.

## Auditing a local dev server

`--url http://localhost:3000` against a hosted backend opens a temporary tunnel so the
audit can reach your machine. Disable it with `--no-tunnel`; it is skipped automatically
when the backend is local too.

## Other commands

| Command | Purpose |
| --- | --- |
| `perfscope login` | Browser-based auth; token stored in the OS config dir |
| `perfscope logout` | Remove saved credentials |
| `perfscope whoami` | Show the signed-in account |
| `perfscope --url <url>` | Audit and print a full report (`--output json\|minimal`) |
