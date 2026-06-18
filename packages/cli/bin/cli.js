#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { printReport, printJson, printMinimal } from '../src/reporter.js';

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

// ── Tunnel ───────────────────────────────────────────────

async function openTunnel(port, spinner) {
  // localtunnel is CJS — import via dynamic require
  const lt = _require('localtunnel');

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Tunnel timed out after 30 s — is your local server running?'));
    }, 30_000);

    lt({ port })
      .then(tunnel => {
        clearTimeout(timeout);
        tunnel.on('error', err => {
          // Surface tunnel drops only if we haven't resolved yet
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

// ── Audit ────────────────────────────────────────────────

async function audit(targetUrl, opts) {
  const apiUrl  = opts.apiUrl.replace(/\/$/, '');
  const apiKey  = opts.key || process.env.PERFSCOPE_API_KEY || '';
  const timeout = parseInt(opts.timeout, 10);
  const output  = opts.output;

  let tunnel = null;
  let auditUrl = targetUrl;

  const spinner = ora({
    text: chalk.dim('Preparing audit…'),
    color: 'green',
  }).start();

  // ── Tunnel for local URLs ──────────────────────────────
  if (isLocal(targetUrl) && opts.tunnel !== false) {
    const port = portOf(targetUrl);
    spinner.text = chalk.dim(`Opening tunnel on port ${port}…`);
    try {
      tunnel = await openTunnel(port, spinner);
      // Replace origin with tunnel URL but keep path/query
      const parsed   = new URL(targetUrl);
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
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const { data } = await axios.post(
      `${apiUrl}/api/analyze`,
      { url: auditUrl },
      { headers, timeout },
    );

    // Accept both { data: {...} } and the result object directly
    result = data?.data ?? data;

    if (!result || typeof result !== 'object') {
      throw new Error('Unexpected API response shape');
    }

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
    case 'json':    printJson(result);                         break;
    case 'minimal': printMinimal(result);                      break;
    default:        printReport(result, targetUrl);            break;
  }
}

// ── CLI definition ───────────────────────────────────────

program
  .name('perfscope')
  .version(pkg.version)
  .description(chalk.bold('⚡ PerfScope') + chalk.dim(' — lightweight Lighthouse audit companion'));

program
  .requiredOption('-u, --url <url>',     'Target URL to audit (local or public)')
  .option('--api-url <url>',             'PerfScope API base URL',          'https://api.perfscope.com')
  .option('-k, --key <apiKey>',          'API key (or PERFSCOPE_API_KEY env)')
  .option('-o, --output <format>',       'Output format: report | json | minimal', 'report')
  .option('-t, --timeout <ms>',          'Request timeout in milliseconds',  '180000')
  .option('--no-tunnel',                 'Disable auto-tunneling for local URLs')
  .addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.dim('$')} npx perfscope --url https://example.com
  ${chalk.dim('$')} npx perfscope --url http://localhost:3000
  ${chalk.dim('$')} npx perfscope --url https://example.com --output json
  ${chalk.dim('$')} npx perfscope --url https://example.com --key <api-key>
  `)
  .action(async (opts) => {
    let url = opts.url;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      // Try prepending https:// for bare domains
      try {
        new URL('https://' + url);
        url = 'https://' + url;
      } catch {
        console.error(chalk.red(`Invalid URL: ${opts.url}`));
        process.exit(1);
      }
    }

    await audit(url, { ...opts, url });
  });

// ── Graceful shutdown ────────────────────────────────────

process.on('SIGINT', () => {
  process.stdout.write('\n');
  console.log(chalk.dim('Interrupted — cleaning up.'));
  process.exit(130);
});

program.parse();
