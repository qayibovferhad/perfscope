#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import http from 'node:http';
import net  from 'node:net';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { printReport, printJson, printMinimal } from '../src/reporter.js';
import {
  loadCredentials, saveCredentials, clearCredentials, getConfigPath,
} from '../src/auth.js';

const _require = createRequire(import.meta.url);
const pkg = _require(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'));

// ── Local URL detection ──────────────────────────────────

const LOCAL_HOSTS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
];

function isLocal(urlStr) {
  try {
    const { hostname } = new URL(urlStr);
    return LOCAL_HOSTS.some(r => r.test(hostname));
  } catch {
    return false;
  }
}

function portOf(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.port) return parseInt(u.port, 10);
    return u.protocol === 'https:' ? 443 : 80;
  } catch {
    return 80;
  }
}

// ── Browser open ─────────────────────────────────────────

function openBrowser(url) {
  try {
    const p = process.platform;
    if      (p === 'darwin')  execSync(`open "${url}"`,              { stdio: 'ignore' });
    else if (p === 'win32')   execSync(`start "" "${url}"`,          { stdio: 'ignore', shell: true });
    else                      execSync(`xdg-open "${url}"`,          { stdio: 'ignore' });
  } catch {
    // user will open manually
  }
}

// ── Tunnel ───────────────────────────────────────────────

async function openTunnel(port, spinner) {
  const lt = _require('localtunnel');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Tunnel timed out after 30 s — is your local server running?'));
    }, 30_000);

    lt({ port })
      .then(tunnel => {
        clearTimeout(timeout);
        tunnel.on('error', err => {
          spinner.warn(chalk.yellow(`Tunnel warning: ${err.message}`));
        });
        resolve(tunnel);
      })
      .catch(err => {
        clearTimeout(timeout);
        reject(new Error(`Could not open tunnel: ${err.message}`));
      });
  });
}

// ── App URL auto-detect ──────────────────────────────────

const PROD_URL  = 'https://app.perfscope.com';
const LOCAL_URL = 'http://127.0.0.1:5173';

function probeLocal() {
  return new Promise(resolve => {
    const sock = net.createConnection({ host: '127.0.0.1', port: 5173 });
    sock.setTimeout(1200);
    sock.on('connect', () => { sock.destroy(); resolve(LOCAL_URL); });
    sock.on('error',   () => resolve(PROD_URL));
    sock.on('timeout', () => { sock.destroy(); resolve(PROD_URL); });
  });
}

async function resolveAppUrl(explicit) {
  if (explicit && explicit !== PROD_URL) return explicit.replace(/\/$/, '');
  return probeLocal();
}

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
      const { data } = await axios.get(`${apiUrl}/api/auth/cli/poll`, {
        params: { code },
        timeout: 5000,
      });
      if (data.token) {
        let email = '';
        try {
          const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString());
          email = payload.email || '';
        } catch { /* non-standard JWT */ }

        saveCredentials(data.token, email);
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

// ── Audit ────────────────────────────────────────────────

async function audit(targetUrl, opts) {
  const apiUrl  = opts.apiUrl.replace(/\/$/, '');
  const timeout = parseInt(opts.timeout, 10);
  const output  = opts.output;

  // Resolve API key: flag → env → saved credentials
  let apiKey = opts.key || process.env.PERFSCOPE_API_KEY || '';
  if (!apiKey) {
    const creds = loadCredentials();
    if (creds?.token) {
      apiKey = creds.token;
    } else {
      console.error(
        chalk.red('Not logged in.') +
        chalk.dim(' Run ') + chalk.white('perfscope login') + chalk.dim(' first.')
      );
      process.exit(1);
    }
  }

  let tunnel  = null;
  let auditUrl = targetUrl;

  const spinner = ora({ text: chalk.dim('Preparing audit…'), color: 'green' }).start();

  // ── Tunnel for local URLs ──────────────────────────────
  if (isLocal(targetUrl) && opts.tunnel !== false) {
    const port = portOf(targetUrl);
    spinner.text = chalk.dim(`Opening tunnel on port ${port}…`);
    try {
      tunnel = await openTunnel(port, spinner);
      const parsed       = new URL(targetUrl);
      const tunnelOrigin = new URL(tunnel.url);
      parsed.hostname = tunnelOrigin.hostname;
      parsed.port     = '';
      parsed.protocol = tunnelOrigin.protocol;
      auditUrl = parsed.toString();
      spinner.succeed(chalk.dim(`Tunnel → ${chalk.greenBright(tunnel.url)}`));
      spinner.start(chalk.dim('Running audit… (this may take up to 2 min)'));
    } catch (err) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    }
  } else {
    spinner.text = chalk.dim('Running audit… (this may take up to 2 min)');
  }

  // ── POST to API ────────────────────────────────────────
  let result;
  try {
    const headers = {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const { data } = await axios.post(
      `${apiUrl}/api/analyze`,
      { url: auditUrl },
      { headers, timeout },
    );

    result = data?.data ?? data;
    if (!result || typeof result !== 'object') throw new Error('Unexpected API response shape');

    spinner.succeed(chalk.greenBright('Audit complete'));
  } catch (err) {
    const msg = err.response
      ? `API error ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.code === 'ECONNABORTED'
      ? `Audit timed out after ${timeout / 1000} s`
      : err.code === 'ECONNREFUSED'
      ? `Cannot reach ${apiUrl} — is the backend running?`
      : err.message;

    spinner.fail(chalk.red(msg));
    if (tunnel) tunnel.close();
    process.exit(1);
  } finally {
    if (tunnel) tunnel.close();
  }

  // ── Output ─────────────────────────────────────────────
  switch (output) {
    case 'json':    printJson(result);              break;
    case 'minimal': printMinimal(result);           break;
    default:        printReport(result, targetUrl); break;
  }
}

// ── CLI definition ───────────────────────────────────────

program
  .name('perfscope')
  .version(pkg.version)
  .description(chalk.bold('⚡ PerfScope') + chalk.dim(' — lightweight Lighthouse audit companion'));

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
  .action(() => {
    clearCredentials();
    console.log(chalk.greenBright('Logged out.') + chalk.dim(' Credentials removed.'));
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

// audit (default)
program
  .option('-u, --url <url>',         'Target URL to audit (local or public)')
  .option('--api-url <url>',         'PerfScope API base URL',         'https://api.perfscope.com')
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
    if (!opts.url) {
      program.help();
      return;
    }

    let url = opts.url;
    try {
      new URL(url);
    } catch {
      try { new URL('https://' + url); url = 'https://' + url; }
      catch { console.error(chalk.red(`Invalid URL: ${opts.url}`)); process.exit(1); }
    }

    await audit(url, { ...opts, url });
  });

// ── Graceful shutdown ────────────────────────────────────

process.on('SIGINT', () => {
  process.stdout.write('\n');
  console.log(chalk.dim('Interrupted — cleaning up.'));
  process.exit(130);
});

await program.parseAsync();
