#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { io } from 'socket.io-client';
import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { printReport, printJson, printMinimal, printInsights } from '../src/reporter.js';
import { unwrap } from '../src/api.js';
import { resolveAccessToken, storedRefreshToken } from '../src/session.js';
import {
  loadCredentials, saveCredentials, clearCredentials, getConfigPath,
} from '../src/auth.js';
import {
  resolveBudget, evaluateBudget, evaluateAll, describeFailure,
  formatValue, labelOf, BUDGET_KEYS, DEFAULT_BUDGET_FILES,
} from '../src/budget.js';
import { appendFileSync } from 'node:fs';
import { isLocal, portOf, hostOf } from '../src/url.js';
import { openBrowser } from '../src/browser.js';
import { openTunnel } from '../src/tunnel.js';
import { resolveAppUrl } from '../src/appUrl.js';

/**
 * Distinct codes so a pipeline can tell "the site is too slow" from "the audit never
 * ran". Only BUDGET means the site failed its own thresholds.
 */
const EXIT = { OK: 0, BUDGET: 1, ERROR: 2 };

/** CI configs usually set an env var rather than threading a flag through every step. */
const DEFAULT_API_URL = process.env.PERFSCOPE_API_URL || 'https://api.perfscope.com';

const _require = createRequire(import.meta.url);
const pkg = _require(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'));

// ── Login ────────────────────────────────────────────────

async function loginCmd(opts) {
  const apiUrl = (opts.apiUrl || 'http://localhost:3101').replace(/\/$/, '');
  const spinner = ora({ text: chalk.dim('Detecting app…'), color: 'green' }).start();
  const appUrl  = await resolveAppUrl(opts.appUrl);

  const code = randomUUID();

  // Register code with backend
  try {
    await axios.post(`${apiUrl}/api/auth/cli/init`, { code }, { timeout: 5000 });
  } catch {
    spinner.fail(chalk.red(`Cannot reach backend at ${apiUrl}. Is it running?`));
    process.exit(1);
  }

  const loginUrl = `${appUrl.replace(/\blocalhost\b/g, '127.0.0.1')}/cli-auth?code=${code}`;
  spinner.info(chalk.dim(`Opening → ${chalk.cyan(loginUrl)}`));
  openBrowser(loginUrl);
  spinner.start(chalk.dim('Waiting for browser login…  (Ctrl+C to cancel)'));

  // Poll backend until token arrives (max 5 min)
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const data = unwrap(await axios.get(`${apiUrl}/api/auth/cli/poll`, {
        params: { code },
        timeout: 5000,
      }));
      if (data.token) {
        let email = '';
        try {
          const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString());
          email = payload.email || '';
        } catch { /* non-standard JWT */ }

        saveCredentials(data, email);
        spinner.succeed(
          chalk.greenBright('Logged in') +
          (email ? chalk.dim(` as ${chalk.white(email)}`) : '') +
          chalk.dim(` · token saved to ${getConfigPath()}`)
        );
        return;
      }
    } catch { /* poll error — keep trying */ }
  }

  spinner.fail(chalk.red('Login timed out (5 min). Run `perfscope login` to try again.'));
}

// ── Website picker ───────────────────────────────────────

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function pickUrl(apiUrl, apiKey, customUrl = '') {
  let websites;
  const spinner = ora({ text: chalk.dim('Loading your websites…'), color: 'green' }).start();
  try {
    websites = unwrap(await axios.get(`${apiUrl}/api/websites`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 8000,
    }));
    spinner.stop();
  } catch {
    spinner.fail(chalk.red('Could not fetch websites. Check --api-url and make sure you are logged in.'));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold('  Your websites:'));
  console.log('');

  websites.forEach((w, i) => {
    const name = w.name ? chalk.white(w.name) + chalk.dim(` (${w.url})`) : chalk.white(w.url);
    console.log(`  ${chalk.dim(`${i + 1}.`)} ${name}`);
  });

  // Custom URL option
  const customIdx = websites.length + 1;
  console.log(`  ${chalk.dim(`${customIdx}.`)} ${chalk.dim('Custom URL')}${customUrl ? chalk.dim(` [${customUrl}]`) : ''}`);
  console.log('');

  const raw = await ask(chalk.dim(`  Select (1-${customIdx}${customUrl ? `, or Enter to use ${customUrl}` : ''}): `));

  const parts = raw.split('.');
  const siteIdx = parseInt(parts[0], 10) - 1;

  // Custom URL chosen (or Enter with --url pre-fill)
  const useCustom = (!raw && customUrl) || siteIdx === customIdx - 1;
  if (useCustom) {
    const input = (!raw && customUrl) ? customUrl : (customUrl || await ask(chalk.dim('  URL: ')));
    if (!input) { console.error(chalk.red('No URL entered.')); process.exit(1); }

    let finalUrl;
    try { new URL(input); finalUrl = input; }
    catch { finalUrl = 'https://' + input; }

    // Check if already in the list (exact match)
    const exactMatch = websites.find(w => w.url === finalUrl);

    if (!exactMatch) {
      let inputOrigin, inputPath;
      try { const u = new URL(finalUrl); inputOrigin = u.origin; inputPath = u.pathname; } catch { inputOrigin = ''; inputPath = '/'; }

      // Check if this is a sub-route of an existing website
      const parent = inputPath !== '/' && websites.find(w => {
        try { return new URL(w.url).origin === inputOrigin; } catch { return false; }
      });

      if (parent) {
        // Add as a route to the parent website
        const existingRoutes = parent.automation?.routes ?? [];
        if (!existingRoutes.includes(inputPath)) {
          const saveSpinner = ora({ text: chalk.dim('Adding route…'), color: 'green' }).start();
          try {
            await axios.patch(`${apiUrl}/api/websites/${parent._id}/automation`,
              { routes: [...existingRoutes, inputPath] },
              { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 },
            );
            saveSpinner.succeed(chalk.greenBright(`Route ${inputPath} added`) + chalk.dim(` to ${parent.url}`));
          } catch {
            saveSpinner.warn(chalk.yellow('Could not save route — proceeding anyway.'));
          }
        }
      } else {
        // Brand new website
        const name = await ask(chalk.dim('  Website name (press Enter to skip): '));
        const saveSpinner = ora({ text: chalk.dim('Saving website…'), color: 'green' }).start();
        try {
          await axios.post(`${apiUrl}/api/websites`,
            { url: finalUrl, name: name || undefined },
            { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 },
          );
          saveSpinner.succeed(chalk.greenBright('Website saved') + chalk.dim(` — ${finalUrl}`));
        } catch {
          saveSpinner.warn(chalk.yellow('Could not save website — proceeding anyway.'));
        }
      }
    }

    return finalUrl;
  }

  if (isNaN(siteIdx) || siteIdx < 0 || siteIdx >= websites.length) {
    console.error(chalk.red('Invalid selection.'));
    process.exit(1);
  }

  const site = websites[siteIdx];
  const routes = site.automation?.routes ?? [];

  if (parts[1] !== undefined) {
    const routeIdx = parseInt(parts[1], 10) - 1;
    if (isNaN(routeIdx) || routeIdx < 0 || routeIdx >= routes.length) {
      console.error(chalk.red('Invalid route selection.')); process.exit(1);
    }
    return site.url.replace(/\/$/, '') + routes[routeIdx];
  }

  // Ask for a route path to audit on this website
  console.log('');
  const routeRaw = await ask(chalk.dim(`  Route path (Enter for /): `));
  if (!routeRaw || routeRaw === '/') return site.url;
  const routePath = routeRaw.startsWith('/') ? routeRaw : `/${routeRaw}`;
  return site.url.replace(/\/$/, '') + routePath;
}

// ── Audit ────────────────────────────────────────────────

/**
 * Resolve the access token: flag → env → saved session, renewing it when it has lapsed.
 *
 * Async now, because a saved session is normally *expired* between commands — access tokens
 * live thirty minutes — and renewing it is a request. See src/session.js for the order of
 * precedence and for the CI story (`PERFSCOPE_REFRESH_TOKEN`).
 */
async function requireApiKey(opts) {
  let token = null;
  try {
    token = await resolveAccessToken(opts);
  } catch {
    console.error(
      chalk.red('Your session has expired.') +
      chalk.dim(' Run ') + chalk.white('perfscope login') + chalk.dim(' again.')
    );
    process.exit(EXIT.ERROR);
  }
  if (token) return token;

  console.error(
    chalk.red('Not logged in.') +
    chalk.dim(' Run ') + chalk.white('perfscope login') + chalk.dim(' first.')
  );
  process.exit(EXIT.ERROR);
}

/**
 * Run one audit and return the raw result.
 *
 * Throws instead of exiting so callers own the exit code — `ci` needs to distinguish an
 * audit that could not run (operational failure) from one that ran and broke its budget.
 */
async function performAudit(targetUrl, opts, apiKey, spinner) {
  const apiUrl  = opts.apiUrl.replace(/\/$/, '');
  const timeout = parseInt(opts.timeout, 10);

  let tunnel   = null;
  let auditUrl = targetUrl;

  // Tunnel for local URLs. Skipped when the API is also local — the backend
  // can reach the target directly, and a tunnel would only add a failure mode.
  if (isLocal(targetUrl) && opts.tunnel !== false && !isLocal(apiUrl)) {
    const port = portOf(targetUrl);
    spinner.text = chalk.dim(`Opening tunnel on port ${port}…`);
    tunnel = await openTunnel(port, spinner);

    const parsed       = new URL(targetUrl);
    const tunnelOrigin = new URL(tunnel.url);
    parsed.hostname = tunnelOrigin.hostname;
    parsed.port     = '';
    parsed.protocol = tunnelOrigin.protocol;
    auditUrl = parsed.toString();

    spinner.succeed(chalk.dim(`Tunnel → ${chalk.greenBright(tunnel.url)}`));
    spinner.start(chalk.dim('Running audit… (this may take up to 2 min)'));
  } else {
    spinner.text = chalk.dim('Running audit… (this may take up to 2 min)');
  }

  try {
    const result = await runSocketAnalysis(apiUrl, apiKey, auditUrl, spinner, timeout);
    if (!result || typeof result !== 'object') throw new Error('Unexpected API response shape');
    return result;
  } finally {
    if (tunnel) tunnel.close();
  }
}

async function audit(targetUrl, opts) {
  const apiKey  = await requireApiKey(opts);
  const spinner = ora({ text: chalk.dim('Preparing audit…'), color: 'green' }).start();

  let result;
  try {
    result = await performAudit(targetUrl, opts, apiKey, spinner);
    spinner.succeed(chalk.greenBright('Audit complete'));
  } catch (err) {
    spinner.fail(chalk.red(err.message));
    process.exit(EXIT.ERROR);
  }

  switch (opts.output) {
    case 'json':    printJson(result);              break;
    case 'minimal': printMinimal(result);           break;
    default:        printReport(result, targetUrl); break;
  }
}


// ── Socket streaming audit ───────────────────────────────
// Same pipeline the web dashboard uses: progress + per-category partial scores
// stream in live, and the run is not subject to the HTTP server timeout.
function runSocketAnalysis(apiUrl, token, url, spinner, timeoutMs) {
  return new Promise((resolve, reject) => {
    // How long to wait for AI commentary after the scores land, before printing anyway.
    const INSIGHTS_GRACE_MS = 6000;

    // These event names and payloads mirror packages/shared/src/types/socket.ts by hand.
    // The CLI publishes to npm standalone, so it cannot take a workspace dependency and
    // nothing checks the two against each other — change one, check the other.
    const socket = io(apiUrl, { auth: token ? { token } : {} });

    const finish = (fn, value) => {
      clearTimeout(timer);
      socket.disconnect();
      fn(value);
    };
    const timer = setTimeout(
      () => finish(reject, new Error(`Audit timed out after ${timeoutMs / 1000} s`)),
      timeoutMs,
    );

    socket.on('connect', () => socket.emit('analysis:start', { url }));
    socket.on('connect_error', (err) =>
      finish(reject, new Error(`Cannot reach ${apiUrl} — is the backend running? (${err.message})`)));

    socket.on('analysis:progress', (p) => {
      spinner.text = chalk.dim(`${p.message ?? 'Auditing…'} (${Math.round(p.progress ?? 0)}%)`);
    });
    socket.on('analysis:partial', (partial) => {
      spinner.text = chalk.dim(`${partial.category}: ${partial.score} — waiting for remaining categories…`);
    });
    // The scores arrive first and the AI commentary a couple of seconds later, so hold the
    // result briefly rather than printing a report with an empty Insights section. A short
    // grace period, not a dependency: if the key is unset or the model is down the event
    // never comes, and the report prints without it exactly as before.
    let done = null;
    let graceTimer = null;
    socket.on('analysis:complete', (result) => {
      done = result;
      graceTimer = setTimeout(() => finish(resolve, done), INSIGHTS_GRACE_MS);
    });
    socket.on('analysis:insights', (data) => {
      if (!done) return;
      if (data?.insights) done.aiInsights = data.insights;
      // Per-audit commentary — dropped here before, so the full report had the page-level
      // insight but never why any one audit fails on this page (see printAuditExplanations
      // in reporter.js). Keyed by AuditItem.id, same as every other surface reads it.
      if (data?.auditExplanations && Array.isArray(done.audits)) {
        for (const audit of done.audits) {
          const explanation = data.auditExplanations[audit.id];
          if (explanation) audit.aiExplanation = explanation;
        }
      }
      // Per-vital notes and the load narrative — generated in the same call as `insights`
      // and shown on the dashboard, but never carried over here before (see
      // printWaterfallNarrative and the vitals loop in reporter.js).
      if (data?.metricNotes) done.aiMetricNotes = data.metricNotes;
      if (data?.waterfall)   done.aiWaterfallNarrative = data.waterfall;
      clearTimeout(graceTimer);
      finish(resolve, done);
    });
    socket.on('analysis:error', (e) => finish(reject, new Error(e?.message ?? 'Analysis failed')));
  });
}

// ── CI mode ──────────────────────────────────────────────

/** GitHub Actions picks these up as inline annotations on the workflow run. */
function ghAnnotate(level, message) {
  if (!process.env.GITHUB_ACTIONS) return;
  console.log(`::${level}::${message.replace(/\n/g, '%0A')}`);
}

/** Markdown table appended to the workflow run page, when running under GitHub Actions. */
function writeGithubSummary(url, rows, passed, aiInsights) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;

  const head = passed ? '### ✅ PerfScope budget passed' : '### ❌ PerfScope budget failed';
  const lines = [
    head,
    '',
    `\`${url}\``,
    '',
    '| Metric | Measured | Budget | Result |',
    '| --- | --- | --- | --- |',
    ...rows.map(r => {
      const measured = r.value == null ? '—' : formatValue(r.metric, r.value);
      const comparator = r.kind === 'floor' ? '≥' : '≤';
      const verdict = r.passed == null ? 'skipped' : r.passed ? 'pass' : '**fail**';
      return `| ${labelOf(r.metric)} | ${measured} | ${comparator} ${formatValue(r.metric, r.budget)} | ${verdict} |`;
    }),
    '',
    // The summary is what the team reads on the PR, long after the log has scrolled by.
    // A table of numbers says what broke; this says what to do about it.
    ...(aiInsights ? ['> ' + String(aiInsights).trim().replace(/\n+/g, '\n> '), ''] : []),
  ].join('\n');

  try {
    appendFileSync(file, lines + '\n');
  } catch {
    // A summary is a nicety — never fail the run over it.
  }
}

function printBudgetTable(rows) {
  console.log('');
  for (const r of rows) {
    const measured   = r.value == null ? chalk.dim('—') : formatValue(r.metric, r.value);
    const comparator = r.kind === 'floor' ? '≥' : '≤';
    const target     = chalk.dim(`${comparator} ${formatValue(r.metric, r.budget)}`);

    const mark = r.passed == null ? chalk.dim('•')
      : r.passed ? chalk.greenBright('✓')
      : chalk.redBright('✗');
    const value = r.passed === false ? chalk.redBright(measured)
      : r.passed ? chalk.greenBright(measured)
      : measured;

    console.log(`  ${mark} ${labelOf(r.metric).padEnd(18)} ${String(value).padStart(9)}  ${target}`);
  }
  console.log('');
}

async function ciCmd(opts) {
  const target = (opts.url || '').trim();
  if (!target) {
    console.error(chalk.red('--url is required.') + chalk.dim(' Example: perfscope ci --url https://example.com'));
    process.exit(EXIT.ERROR);
  }
  const targetUrl = target.startsWith('http') ? target : `https://${target}`;

  // Resolve the budget before spending two minutes on an audit nothing will assert.
  let budget, sourceFile;
  try {
    ({ budget, sourceFile } = resolveBudget({ budget: opts.budget, budgetFile: opts.budgetFile }));
  } catch (err) {
    console.error(chalk.red(err.message));
    process.exit(EXIT.ERROR);
  }

  if (Object.keys(budget).length === 0) {
    console.error(
      chalk.red('No budget configured.') + '\n' +
      chalk.dim(`  Pass --budget "performance=80,lcp=2500", or add one of: ${DEFAULT_BUDGET_FILES.join(', ')}\n`) +
      chalk.dim(`  Valid keys: ${BUDGET_KEYS.join(', ')}`)
    );
    process.exit(EXIT.ERROR);
  }

  const apiKey = await requireApiKey(opts);

  // --json output must be the only thing on stdout so `perfscope ci --json | jq` works;
  // everything human-facing goes to stderr (where ora already writes its spinner).
  const say = opts.json ? (line) => console.error(line) : (line) => console.log(line);
  say(chalk.bold('\n  PerfScope CI'));
  say(chalk.dim(`  ${targetUrl}`));
  if (sourceFile) say(chalk.dim(`  budget: ${sourceFile}`));
  say('');

  // Spinners animate on a TTY; CI logs get a plain line instead of escape soup.
  const isTty   = Boolean(process.stdout.isTTY);
  const spinner = isTty
    ? ora({ text: chalk.dim('Preparing audit…'), color: 'green' }).start()
    : { text: '', start() { return this; }, succeed(t) { if (t) console.error(t); }, fail(t) { if (t) console.error(t); }, warn(t) { if (t) console.error(t); }, stop() {} };

  let result;
  try {
    result = await performAudit(targetUrl, opts, apiKey, spinner);
    spinner.succeed(chalk.dim('Audit complete'));
  } catch (err) {
    spinner.fail(chalk.red(err.message));
    ghAnnotate('error', `PerfScope audit failed: ${err.message}`);
    process.exit(EXIT.ERROR);
  }

  const rows     = evaluateAll(result, budget);
  const failures = evaluateBudget(result, budget);
  const passed   = failures.length === 0;

  if (opts.json) {
    printJson({
      url: targetUrl,
      analysisId: result.id,
      formFactor: result.formFactor ?? null,
      scores: result.scores,
      metrics: result.metrics,
      budget,
      passed,
      failures,
      aiInsights: result.aiInsights ?? null,
    });
  } else {
    printBudgetTable(rows);
  }

  writeGithubSummary(targetUrl, rows, passed, result.aiInsights);

  if (passed) {
    say(chalk.greenBright('  ✓ Budget passed') + chalk.dim(` — ${rows.length} threshold(s) checked\n`));
    process.exit(EXIT.OK);
  }

  say(chalk.redBright('  ✗ Budget failed') + chalk.dim(` — ${failures.length} of ${rows.length} threshold(s)\n`));
  for (const f of failures) ghAnnotate('error', `${targetUrl} — ${describeFailure(f)}`);

  // The one moment a developer is definitely reading this output is when it just failed
  // their build — and until now it told them a number was too high and nothing else. The
  // commentary is already generated and already on the result; it was simply dropped.
  printInsights(result.aiInsights);

  process.exit(opts.warnOnly ? EXIT.OK : EXIT.BUDGET);
}

// ── Deploy ───────────────────────────────────────────────

/**
 * Record a release, so the charts can say *why* a line moved.
 *
 * Meant to be one line in a pipeline, right after the deploy step. It never fails the
 * build: a marker that could not be recorded is a missing annotation, and taking a green
 * release red over an annotation would teach everyone to drop the step.
 */
async function deployCmd(opts) {
  const apiKey = await requireApiKey(opts);
  const apiUrl = opts.apiUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${apiKey}` };

  if (!opts.site) {
    console.error(chalk.red('Missing --site.') + chalk.dim(' The URL of the site this release went out to.'));
    process.exit(EXIT.ERROR);
  }

  try {
    const sites = unwrap(await axios.get(`${apiUrl}/api/websites`, { headers, timeout: 15000 }));
    const wanted = hostOf(opts.site);
    const site = (Array.isArray(sites) ? sites : []).find((s) => hostOf(s.url) === wanted);
    if (!site) {
      console.error(
        chalk.red(`No website matching ${wanted}.`) +
        chalk.dim(' Add it in the dashboard first — a deploy is recorded against a site.')
      );
      process.exit(EXIT.ERROR);
    }

    // Every field is optional on the server; `ref` is what makes a retried pipeline step
    // record one marker rather than two.
    const body = {};
    if (opts.ref)   body.ref   = opts.ref;
    if (opts.label) body.label = opts.label;
    if (opts.url)   body.url   = opts.url;
    if (opts.at)    body.at    = opts.at;

    const saved = unwrap(await axios.post(
      `${apiUrl}/api/websites/${site._id}/deploys`, body, { headers, timeout: 15000 },
    ));

    console.log(
      chalk.greenBright('●') + ' Deploy recorded ' +
      chalk.white(saved.label || saved.ref || new Date(saved.at).toISOString()) +
      chalk.dim(` → ${wanted}`)
    );
  } catch (err) {
    // Deliberately EXIT.OK: see the note above.
    console.error(chalk.yellow('Could not record the deploy.') + chalk.dim(` ${err.message}`));
    process.exit(EXIT.OK);
  }
}

// ── CLI definition ───────────────────────────────────────

program
  .name('perfscope')
  .version(pkg.version)
  .description(chalk.bold('⚡ PerfScope') + chalk.dim(' — lightweight Lighthouse audit companion'))
  // The bare `perfscope --url X` form declares --url on the program itself, which would
  // otherwise swallow the identically-named flag of the `ci` subcommand. Positional
  // options bind anything after a subcommand name to that subcommand.
  .enablePositionalOptions();

// login
program
  .command('login')
  .description('Log in to your PerfScope account via browser')
  .option('--app-url <url>', 'PerfScope app URL',  'https://app.perfscope.com')
  .option('--api-url <url>', 'PerfScope API URL',  'http://localhost:3101')
  .action(loginCmd);

// logout
program
  .command('logout')
  .description('Remove saved PerfScope credentials')
  .option('--api-url <url>', 'PerfScope API URL', 'http://localhost:3101')
  .action(async (opts) => {
    // End it on the server as well: the refresh token is good for a month, and deleting the
    // local file would leave that session alive on a machine somebody may not control.
    const refreshToken = storedRefreshToken();
    if (refreshToken) {
      try {
        await axios.post(`${opts.apiUrl.replace(/\/$/, '')}/api/auth/logout`, { refreshToken }, { timeout: 5000 });
      } catch { /* best effort — the local half must happen either way */ }
    }
    clearCredentials();
    console.log(chalk.greenBright('Logged out.') + chalk.dim(' Session ended and credentials removed.'));
  });

// whoami
program
  .command('whoami')
  .description('Show currently logged-in account')
  .action(() => {
    const creds = loadCredentials();
    if (!creds) {
      console.log(chalk.dim('Not logged in. Run ') + chalk.white('perfscope login') + chalk.dim('.'));
    } else {
      console.log(
        chalk.greenBright('●') + ' ' + chalk.white(creds.email || 'unknown email') +
        chalk.dim(`  (saved ${new Date(creds.savedAt).toLocaleString()})`)
      );
    }
  });

// ci — audit once, assert a budget, exit non-zero on breach
program
  .command('ci')
  .description('Run an audit and fail the build when a performance budget is breached')
  .requiredOption('-u, --url <url>',      'URL to audit')
  .option('-b, --budget <spec>',          'Inline budget, e.g. "performance=80,lcp=2500"')
  .option('-f, --budget-file <path>',     `Budget JSON (auto-detects ${DEFAULT_BUDGET_FILES.join(' / ')})`)
  .option('--api-url <url>',              'PerfScope API base URL ($PERFSCOPE_API_URL)', DEFAULT_API_URL)
  .option('-k, --key <apiKey>',           'API key (overrides saved login)')
  .option('-t, --timeout <ms>',           'Audit timeout in ms',             '180000')
  .option('--json',                       'Emit machine-readable JSON instead of a table')
  .option('--warn-only',                  'Report breaches but always exit 0')
  .option('--no-tunnel',                  'Disable auto-tunneling for local URLs')
  .addHelpText('after', `
${chalk.bold('Exit codes:')}
  ${chalk.dim('0')}  budget passed (or --warn-only)
  ${chalk.dim('1')}  budget breached
  ${chalk.dim('2')}  audit could not run

${chalk.bold('Budget keys:')} ${chalk.dim(BUDGET_KEYS.join(', '))}
  ${chalk.dim('performance is a floor (score must stay above); the rest are ceilings.')}

${chalk.bold('perfscope.json:')}
  ${chalk.dim('{ "performance": 80, "lcp": 2500, "cls": 0.1 }')}

${chalk.bold('GitHub Actions:')}
  ${chalk.dim('- run: npx perfscope ci --url https://example.com')}
  ${chalk.dim('  env:')}
  ${chalk.dim('    PERFSCOPE_API_KEY: ${{ secrets.PERFSCOPE_API_KEY }}')}
  `)
  .action(ciCmd);

// deploy
program
  .command('deploy')
  .description('Mark a release on this site\'s charts')
  .requiredOption('-s, --site <url>',   'The site that was deployed (matched by hostname)')
  .option('-r, --ref <ref>',            'Commit sha, tag or build number (makes the call idempotent)')
  .option('-l, --label <label>',        'What to call it on the chart, e.g. "v2.4.0"')
  .option('--url <url>',                'Where to read about it — a commit, PR or pipeline run')
  .option('--at <iso>',                 'When it went out (ISO 8601). Defaults to now')
  .option('--api-url <url>',            'PerfScope API base URL ($PERFSCOPE_API_URL)', DEFAULT_API_URL)
  .option('-k, --key <apiKey>',         'API key (overrides saved login)')
  .addHelpText('after', `
${chalk.bold('In a pipeline:')}
  ${chalk.dim('$')} npx perfscope deploy --site https://mysite.com --ref $GITHUB_SHA --label $GITHUB_REF_NAME

  ${chalk.dim('Never fails the build — a marker that could not be recorded is a missing')}
  ${chalk.dim('annotation, not a broken release.')}
  `)
  .action(deployCmd);

// audit (default)
program
  .option('-u, --url <url>',         'Target URL to audit (local or public)')
  .option('--api-url <url>',         'PerfScope API base URL ($PERFSCOPE_API_URL)', DEFAULT_API_URL)
  .option('-k, --key <apiKey>',      'API key (overrides saved login)')
  .option('-o, --output <format>',   'Output: report | json | minimal', 'report')
  .option('-t, --timeout <ms>',      'Request timeout in ms',           '180000')
  .option('--no-tunnel',             'Disable auto-tunneling for local URLs')
  .addHelpText('after', `
${chalk.bold('Quick start:')}
  ${chalk.dim('$')} npx perfscope login
  ${chalk.dim('$')} npx perfscope --url https://mysite.com
  ${chalk.dim('$')} npx perfscope --url http://localhost:3000
  `)
  .action(async (opts) => {
    // Resolve API key early so picker can use it
    let apiKey = opts.key || process.env.PERFSCOPE_API_KEY || '';
    if (!apiKey) {
      const creds = loadCredentials();
      if (creds?.token) {
        apiKey = creds.token;
      } else {
        console.error(chalk.red('Not logged in.') + chalk.dim(' Run ') + chalk.white('perfscope login') + chalk.dim(' first.'));
        process.exit(1);
      }
    }

    const apiUrl = opts.apiUrl.replace(/\/$/, '');
    const url = await pickUrl(apiUrl, apiKey, opts.url);
    console.log(chalk.dim(`  Auditing → ${chalk.white(url)}\n`));

    await audit(url, { ...opts, url, key: apiKey });
  });

// ── Graceful shutdown ────────────────────────────────────

process.on('SIGINT', () => {
  process.stdout.write('\n');
  console.log(chalk.dim('Interrupted — cleaning up.'));
  process.exit(130);
});

await program.parseAsync();
