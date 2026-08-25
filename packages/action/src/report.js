/**
 * What the PR sees.
 *
 * Everything here is pure: it turns `perfscope ci --json` into a comment body, a check-run
 * payload and a step summary, and knows nothing about the network. The half that talks to
 * GitHub lives in `post.js`, which is a thin wrapper over `fetch` — this is where the
 * decisions are, so this is what the tests exercise.
 */

/**
 * The marker that makes a comment *the* PerfScope comment.
 *
 * A build that comments on every push turns a ten-comment PR into a hundred-comment PR, and
 * the useful state — how the branch stands *now* — is buried in the middle of it. The
 * comment is found by this marker and edited in place instead. It carries the audited URL,
 * so a pipeline that checks three pages keeps three comments rather than three of them
 * fighting over one.
 */
export const stickyMarker = (url) => `<!-- perfscope-ci:${url} -->`;

const METRIC_LABEL = {
  performance: 'Performance',
  lcp: 'LCP', tbt: 'TBT', cls: 'CLS', inp: 'INP', fcp: 'FCP', ttfb: 'TTFB', si: 'Speed Index',
};

const label = (metric) => METRIC_LABEL[metric] ?? metric.toUpperCase();

/** Scores are whole numbers, CLS has three decimals, everything else is milliseconds. */
export function formatValue(metric, value) {
  if (value == null) return '—';
  if (metric === 'performance') return String(Math.round(value));
  if (metric === 'cls') return value.toFixed(3);
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

/**
 * How far a metric moved since the last run of the same URL, as a signed string.
 *
 * Returns null when there is nothing to compare, when the move is zero, and — deliberately —
 * when the metric is not one the budget is checking: a comment that lists every metric's
 * wobble is a comment nobody reads twice.
 */
export function formatDelta(metric, value, previous) {
  if (value == null || previous == null) return null;
  const before = metric === 'performance' ? previous.scores?.performance : previous.metrics?.[metric];
  if (typeof before !== 'number') return null;

  const change = value - before;
  if (change === 0) return null;

  // Up is good for a score and bad for everything else — the arrow says *better or worse*,
  // not *higher or lower*, because that is the question being asked.
  const better = metric === 'performance' ? change > 0 : change < 0;
  const sign = change > 0 ? '+' : '−';
  const magnitude = formatValue(metric, Math.abs(change));
  return `${better ? '🟢' : '🔴'} ${sign}${magnitude}`;
}

/**
 * The comment.
 *
 * One verdict line, one table, and whatever else is actually known — the AI note and the
 * public link are both optional and both simply absent when they were not produced. There
 * is no "AI unavailable" placeholder here for the same reason the app has none.
 */
export function buildComment(result, context = {}) {
  const { passed, url, checks = [], previous = null, aiInsights = null, reportUrl = null } = result;
  const failed = checks.filter((c) => c.passed === false).length;

  const heading = passed
    ? `### ✅ PerfScope — budget passed`
    : `### ❌ PerfScope — budget failed (${failed} of ${checks.length})`;

  const rows = checks.map((check) => {
    const comparator = check.kind === 'floor' ? '≥' : '≤';
    const verdict = check.passed == null ? '—' : check.passed ? '✅' : '**❌**';
    const delta = formatDelta(check.metric, check.value, previous);
    return `| ${label(check.metric)} | ${formatValue(check.metric, check.value)} | ${comparator} ${formatValue(check.metric, check.budget)} | ${delta ?? ''} | ${verdict} |`;
  });

  const lines = [
    stickyMarker(url),
    heading,
    '',
    `\`${url}\`${result.formFactor ? ` · ${result.formFactor}` : ''}`,
    '',
    '| Metric | Measured | Budget | Since last run | |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ];

  if (aiInsights) {
    // Quoted rather than fenced: this is prose about the page, and a code block in a PR
    // comment reads as output to copy.
    lines.push('', '> ' + String(aiInsights).trim().replace(/\n+/g, '\n> '));
  }

  const footer = [];
  if (reportUrl) footer.push(`[Full report](${reportUrl})`);
  if (context.sha) footer.push(`\`${String(context.sha).slice(0, 7)}\``);
  if (footer.length) lines.push('', `<sub>${footer.join(' · ')}</sub>`);

  return lines.join('\n');
}

/** The check run: a title a reader can judge from the checks list alone, and the same table. */
export function buildCheckRun(result, context = {}) {
  const { passed, url, checks = [] } = result;
  const failed = checks.filter((c) => c.passed === false);

  const title = passed
    ? `Budget passed — ${checks.length} threshold${checks.length === 1 ? '' : 's'}`
    : `Budget failed — ${failed.map((f) => label(f.metric)).join(', ')}`;

  return {
    name: context.name ?? 'PerfScope budget',
    head_sha: context.sha,
    status: 'completed',
    // `neutral` rather than `failure` under warn-only: the run reports what it measured and
    // the workflow was explicitly told not to block on it, so a red check would be a lie
    // about the build's own rules.
    conclusion: passed ? 'success' : context.warnOnly ? 'neutral' : 'failure',
    output: {
      title,
      summary: buildComment(result, context).replace(stickyMarker(url) + '\n', ''),
    },
  };
}

/** What a run that never produced a result says — an audit that could not run is a finding
 *  too, and a silent green check would hide it. */
export function buildErrorComment(url, message) {
  return [
    stickyMarker(url),
    '### ⚠️ PerfScope — the audit could not run',
    '',
    `\`${url}\``,
    '',
    '```',
    String(message).trim().slice(0, 1500),
    '```',
  ].join('\n');
}
