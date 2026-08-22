import chalk from 'chalk';

const W = 62;
const LINE = chalk.dim('─'.repeat(W));
const DIVIDER = (label) => {
  const pad = W - label.length - 4;
  const l = Math.floor(pad / 2);
  const r = pad - l;
  return chalk.dim('─'.repeat(l) + '─ ') + chalk.bold.dim(label) + chalk.dim(' ' + '─'.repeat(r));
};

// ── Score helpers ────────────────────────────────────────

function scoreColor(n) {
  if (n >= 90) return chalk.greenBright;
  if (n >= 50) return chalk.yellow;
  return chalk.redBright;
}

function scoreLabel(n) {
  if (n >= 90) return chalk.dim.green('GOOD');
  if (n >= 50) return chalk.dim.yellow('NEEDS IMPROVEMENT');
  return chalk.dim.red('POOR');
}

function scoreBar(n) {
  const filled = Math.round(n / 10);
  const empty  = 10 - filled;
  const color  = scoreColor(n);
  return chalk.dim('[') + color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty)) + chalk.dim(']');
}

// ── Metric helpers ───────────────────────────────────────

const BANDS = {
  lcp: { good: 2500,  ni: 4000,  unit: 'ms', label: 'LCP' },
  tbt: { good: 200,   ni: 600,   unit: 'ms', label: 'TBT' },
  cls: { good: 0.1,   ni: 0.25,  unit: '',   label: 'CLS' },
  fcp: { good: 1800,  ni: 3000,  unit: 'ms', label: 'FCP' },
  tti: { good: 3800,  ni: 7300,  unit: 'ms', label: 'TTI' },
};

function metricStatus(key, value) {
  const b = BANDS[key];
  if (!b) return { label: '●  Unknown', color: chalk.dim };
  if (value <= b.good) return { label: '✓  Good',              color: chalk.greenBright };
  if (value <= b.ni)   return { label: '⚠  Needs Improvement', color: chalk.yellow };
  return               { label: '✗  Poor',              color: chalk.redBright };
}

function fmtMetric(key, value) {
  if (key === 'cls') return value.toFixed(3);
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

// ── Layout helpers ───────────────────────────────────────

function pad(str, width) {
  // The control character is the point: chalk's colour codes take no space on screen, so
  // they have to come out before the visible width can be measured.
  // eslint-disable-next-line no-control-regex
  const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
  return str + ' '.repeat(Math.max(0, width - visible.length));
}

function row(label, value, extra = '') {
  return `  ${chalk.dim(pad(label, 16))} ${value}  ${extra}`;
}

/** Greedy word-wrap to `maxCols` — the one paragraph-wrapping rule every section here
 *  that prints prose (the AI insight, an audit's explanation) shares. */
function wrapText(text, maxCols) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxCols) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

const IMPACT_COLOR = {
  critical: chalk.redBright,
  high:     chalk.red,
  medium:   chalk.yellow,
  low:      chalk.dim,
};

// ── Main export ──────────────────────────────────────────

/**
 * "Δ vs previous" for one number, or an empty string when there is no baseline.
 *
 * Deliberately dumber than the dashboard's DeltaBadge: a terminal report is read once,
 * usually in CI output next to a pass/fail, so it shows the movement and leaves the
 * "is this noise" judgement to the thresholds that actually gate the build (see
 * budget.js). Direction is all it has to get right — up is good for a score, bad for a
 * timing.
 */
function deltaText(curr, prev, { higherIsBetter, format }) {
  if (typeof prev !== 'number' || typeof curr !== 'number') return '';
  const diff = curr - prev;
  if (diff === 0) return chalk.dim(' (=)');
  const better = higherIsBetter ? diff > 0 : diff < 0;
  const color  = better ? chalk.greenBright : chalk.redBright;
  return color(` (${diff > 0 ? '+' : '-'}${format(Math.abs(diff))})`);
}

export function printReport(result, originalUrl) {
  const { url, scores, metrics, aiInsights, aiMetricNotes, aiWaterfallNarrative, audits, timestamp, previous } = result;

  const date = timestamp
    ? new Date(timestamp).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });

  const displayUrl = originalUrl || url || '—';

  console.log('');
  console.log(chalk.bold.greenBright('  ╔' + '═'.repeat(W) + '╗'));
  console.log(chalk.bold.greenBright('  ║') + chalk.bold('  ⚡ PerfScope  ·  Performance Audit Report' + ' '.repeat(W - 43)) + chalk.bold.greenBright('║'));
  console.log(chalk.bold.greenBright('  ╚' + '═'.repeat(W) + '╝'));
  console.log('');
  console.log(row('URL', chalk.cyan(displayUrl)));
  console.log(row('Audited', chalk.dim(date)));
  console.log('');

  // ── Scores ──────────────────────────────────────────────
  console.log('  ' + DIVIDER('SCORES'));
  console.log('');

  const scoreMap = [
    ['Performance',    scores?.performance   ?? 0],
    ['Accessibility',  scores?.accessibility  ?? 0],
    ['Best Practices', scores?.bestPractices  ?? 0],
    ['SEO',            scores?.seo            ?? 0],
  ];

  const prevScores = previous?.scores;
  const scoreKeys  = ['performance', 'accessibility', 'bestPractices', 'seo'];

  for (const [i, [label, val]] of scoreMap.entries()) {
    const n     = Math.round(val > 1 ? val : val * 100);
    const color = scoreColor(n);
    const delta = deltaText(n, prevScores?.[scoreKeys[i]], {
      higherIsBetter: true, format: (d) => String(Math.round(d)),
    });
    console.log(`  ${pad(chalk.dim(label), 22)} ${scoreBar(n)} ${color(pad(String(n), 4))} ${scoreLabel(n)}${delta}`);
  }

  if (previous?.at) {
    console.log('');
    console.log(chalk.dim(`  Compared with the run from ${new Date(previous.at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`));
  }

  console.log('');

  // ── Core Web Vitals ──────────────────────────────────────
  console.log('  ' + DIVIDER('CORE WEB VITALS'));
  console.log('');
  console.log(chalk.dim('  Metric     Value          Status'));
  console.log('  ' + LINE);

  for (const key of ['lcp', 'tbt', 'cls', 'fcp', 'tti']) {
    const raw   = metrics?.[key];
    if (raw == null) continue;
    const label = BANDS[key]?.label ?? key.toUpperCase();
    const fmt   = fmtMetric(key, raw);
    const { label: statusLabel, color } = metricStatus(key, raw);
    const delta = deltaText(raw, previous?.metrics?.[key], {
      higherIsBetter: false, format: (d) => fmtMetric(key, d),
    });
    console.log(`  ${pad(chalk.dim(label), 10)} ${pad(fmt, 15)} ${color(statusLabel)}${delta}`);
    const note = aiMetricNotes?.[key];
    if (note) for (const line of wrapText(note, W - 14)) console.log(`             ${chalk.dim.italic(line)}`);
  }

  console.log('');

  printInsights(aiInsights);
  printWaterfallNarrative(aiWaterfallNarrative);
  printAuditExplanations(audits);

  // ── Next Steps ───────────────────────────────────────────
  console.log('  ' + DIVIDER('NEXT STEPS'));
  console.log('');
  console.log(`  ${chalk.dim('→')} Full history  ${chalk.cyan('https://app.perfscope.com/history')}`);
  console.log(`  ${chalk.dim('→')} Run again     ${chalk.dim(`npx perfscope --url ${displayUrl}`)}`);
  console.log('');
  console.log('  ' + LINE);
  console.log('');
}

/**
 * Gemini's read on the audit, wrapped to the terminal.
 *
 * Its own export because two places need it and only one had it: the full report printed
 * the commentary, while `perfscope ci` — the one moment a developer is definitely reading
 * this output, because it just failed their build — printed a number that was too high and
 * nothing about what to do. It is already generated and already on the result.
 *
 * A no-op when there is nothing to say, so callers do not have to check first.
 */
export function printInsights(aiInsights) {
  if (!aiInsights || typeof aiInsights !== 'string' || !aiInsights.trim()) return;

  console.log('  ' + DIVIDER('SENIOR INSIGHT'));
  console.log('');

  const lines = wrapText(aiInsights, W - 8);

  console.log(`  ${chalk.yellow('💡')} ${chalk.italic(lines[0] ?? '')}`);
  for (let i = 1; i < lines.length; i++) {
    console.log(`     ${chalk.dim(lines[i])}`);
  }
  console.log('');
}

/**
 * How this specific load actually went, in order — the same narrative the dashboard's
 * "How this page loaded" card shows, generated by `analysePage` alongside the diagnosis
 * but silently dropped by every report printed here until now. A no-op when absent, same
 * as `printInsights` — a 'standard'-depth (scheduled/CI) audit never asked for it.
 */
export function printWaterfallNarrative(waterfall) {
  if (!waterfall || typeof waterfall !== 'string' || !waterfall.trim()) return;

  console.log('  ' + DIVIDER('HOW THIS PAGE LOADED'));
  console.log('');
  for (const line of wrapText(waterfall, W - 4)) console.log(`  ${chalk.dim(line)}`);
  console.log('');
}

/**
 * Per-audit commentary — why *this* audit fails on *this* page, not what the audit means
 * in general. The full report used to stop at the page-level insight above and never
 * showed these, even though they were already sitting on `result.audits[].aiExplanation`
 * (phase 6 of docs/ai/PLAN.md: the CLI report skipped per-audit lines every other AI
 * surface in the product already had).
 *
 * Only failing audits with an explanation — a passing audit has nothing to explain, and
 * one Gemini did not reach (deep enrichment did not run, or it had nothing to say) prints
 * nothing rather than a blank line.
 */
export function printAuditExplanations(audits) {
  const explained = (audits ?? []).filter((a) => a?.aiExplanation && a.aiExplanation.trim());
  if (explained.length === 0) return;

  console.log('  ' + DIVIDER('WHY THESE AUDITS FAIL HERE'));
  console.log('');

  for (const audit of explained) {
    const impactColor = IMPACT_COLOR[audit.impact] ?? chalk.dim;
    console.log(`  ${impactColor('●')} ${chalk.bold(audit.title)}`);
    for (const line of wrapText(audit.aiExplanation, W - 6)) {
      console.log(`    ${chalk.dim(line)}`);
    }
    console.log('');
  }
}

export function printJson(result) {
  console.log(JSON.stringify(result, null, 2));
}

export function printMinimal(result) {
  const scores  = result?.scores ?? {};
  const metrics = result?.metrics ?? {};
  const perf    = Math.round((scores.performance ?? 0) > 1 ? scores.performance : (scores.performance ?? 0) * 100);
  console.log(
    chalk.bold(`performance:${perf}`) +
    chalk.dim(`  lcp:${fmtMetric('lcp', metrics.lcp ?? 0)}`) +
    chalk.dim(`  tbt:${fmtMetric('tbt', metrics.tbt ?? 0)}`) +
    chalk.dim(`  cls:${fmtMetric('cls', metrics.cls ?? 0)}`)
  );
}
