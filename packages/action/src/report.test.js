import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComment, buildCheckRun, buildErrorComment, formatDelta, formatValue, stickyMarker } from './report.js';
import { pullRequestNumber, headSha } from './post.js';

const result = (over = {}) => ({
  url: 'https://example.com/',
  formFactor: 'mobile',
  passed: true,
  scores: { performance: 84 },
  metrics: { lcp: 2100, cls: 0.04 },
  checks: [
    { metric: 'performance', value: 84, budget: 80, kind: 'floor', passed: true },
    { metric: 'lcp', value: 2100, budget: 2500, kind: 'ceiling', passed: true },
  ],
  previous: null,
  aiInsights: null,
  reportUrl: null,
  ...over,
});

test('formatValue speaks each metric its own way', () => {
  assert.equal(formatValue('performance', 84.6), '85');
  assert.equal(formatValue('cls', 0.041), '0.041');
  assert.equal(formatValue('lcp', 2100), '2.10s');
  assert.equal(formatValue('tbt', 240), '240ms');
  // A threshold the audit could not measure is a dash, never a zero: those mean different
  // things and a zero would read as a perfect score.
  assert.equal(formatValue('lcp', null), '—');
});

test('the delta arrow means better or worse, not higher or lower', () => {
  const previous = { scores: { performance: 80 }, metrics: { lcp: 1800 } };
  // A score going up is good; LCP going up is not. Both are "+".
  assert.match(formatDelta('performance', 84, previous), /^🟢 \+4$/);
  assert.match(formatDelta('lcp', 2100, previous), /^🔴 \+300ms$/);
  assert.match(formatDelta('lcp', 1500, previous), /^🟢 −300ms$/);
});

test('there is no delta when there is nothing to compare', () => {
  assert.equal(formatDelta('lcp', 2100, null), null);
  assert.equal(formatDelta('lcp', 2100, { scores: {}, metrics: {} }), null);
  // No movement is not news.
  assert.equal(formatDelta('lcp', 2100, { metrics: { lcp: 2100 } }), null);
});

test('a passing run leads with the verdict and lists every threshold', () => {
  const body = buildComment(result());
  assert.match(body, /### ✅ PerfScope — budget passed/);
  assert.match(body, /\| Performance \| 84 \| ≥ 80 \|/);
  assert.match(body, /\| LCP \| 2\.10s \| ≤ 2\.50s \|/);
});

test('a failing run says how many of how many', () => {
  // "Budget failed" alone leaves the reader counting rows; the ratio is the sentence.
  const body = buildComment(result({
    passed: false,
    checks: [
      { metric: 'performance', value: 61, budget: 80, kind: 'floor', passed: false },
      { metric: 'lcp', value: 2100, budget: 2500, kind: 'ceiling', passed: true },
    ],
  }));
  assert.match(body, /budget failed \(1 of 2\)/);
  assert.match(body, /\*\*❌\*\*/);
});

test('the marker carries the URL, so several audited pages keep several comments', () => {
  const a = buildComment(result({ url: 'https://example.com/' }));
  const b = buildComment(result({ url: 'https://example.com/pricing' }));
  assert.ok(a.startsWith(stickyMarker('https://example.com/')));
  assert.notEqual(a.split('\n')[0], b.split('\n')[0]);
});

test('the AI note and the report link appear only when they exist', () => {
  const bare = buildComment(result());
  // No quote line at all — an "AI unavailable" placeholder is exactly what the app refuses
  // to render, and an empty `>` block is that placeholder wearing a different hat.
  assert.ok(!bare.split('\n').some(line => line.startsWith('> ')), 'no empty quote block');
  assert.ok(!bare.includes('Full report'));

  const rich = buildComment(
    result({ aiInsights: 'The hero image is the LCP element.\nIt is 400KB.', reportUrl: 'https://app.test/report/abc' }),
    { sha: 'abcdef1234567890' },
  );
  assert.match(rich, />\s?The hero image is the LCP element\./);
  assert.match(rich, /> It is 400KB\./);
  assert.match(rich, /\[Full report\]\(https:\/\/app\.test\/report\/abc\)/);
  assert.match(rich, /`abcdef1`/);
});

test('the check run names what broke, so the checks list alone is readable', () => {
  const payload = buildCheckRun(result({
    passed: false,
    checks: [
      { metric: 'lcp', value: 4200, budget: 2500, kind: 'ceiling', passed: false },
      { metric: 'cls', value: 0.3, budget: 0.1, kind: 'ceiling', passed: false },
    ],
  }), { sha: 'deadbeef' });

  assert.equal(payload.conclusion, 'failure');
  assert.equal(payload.head_sha, 'deadbeef');
  assert.match(payload.output.title, /Budget failed — LCP, CLS/);
  // The marker belongs to the comment; a check summary is not deduplicated by anything.
  assert.ok(!payload.output.summary.includes('<!-- perfscope-ci'));
});

test('warn-only reports neutral rather than red', () => {
  // The workflow was told not to block on this. A red check would be a claim about the
  // build's own rules that the build does not make.
  const failing = result({ passed: false, checks: [{ metric: 'lcp', value: 4200, budget: 2500, kind: 'ceiling', passed: false }] });
  assert.equal(buildCheckRun(failing, { sha: 'x', warnOnly: true }).conclusion, 'neutral');
  assert.equal(buildCheckRun(failing, { sha: 'x' }).conclusion, 'failure');
  assert.equal(buildCheckRun(result(), { sha: 'x' }).conclusion, 'success');
});

test('an audit that never ran says so instead of leaving a green silence', () => {
  const body = buildErrorComment('https://example.com/', 'Audit timed out after 180000ms');
  assert.ok(body.startsWith(stickyMarker('https://example.com/')));
  assert.match(body, /could not run/);
  assert.match(body, /Audit timed out/);
});

test('the pull request is read from the event, never guessed', () => {
  assert.equal(pullRequestNumber({ pull_request: { number: 42 } }, 'pull_request'), 42);
  assert.equal(pullRequestNumber({ pull_request: { number: 42 } }, 'pull_request_target'), 42);
  // A push has no PR, and finding one for it is how a comment lands on a PR nobody was
  // looking at.
  assert.equal(pullRequestNumber({ ref: 'refs/heads/main' }, 'push'), null);
  assert.equal(pullRequestNumber(null, 'schedule'), null);
});

test('the check goes on the head commit, not on the merge commit GitHub invented', () => {
  // GITHUB_SHA on a pull_request event is a merge commit no branch points at, and a check
  // run against it is not shown on the PR at all.
  const event = { pull_request: { head: { sha: 'head123' } } };
  assert.equal(headSha(event, 'pull_request', 'merge999'), 'head123');
  assert.equal(headSha({}, 'push', 'push123'), 'push123');
});
