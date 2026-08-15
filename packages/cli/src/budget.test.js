/**
 * Tests for the budget module that decides whether `perfscope ci` fails a build.
 *
 * Uses `node:test` rather than vitest on purpose: this package publishes to npm on its own
 * with no workspace dependencies, and a test runner in devDependencies is still a
 * dependency someone has to install to verify it.
 *
 *     node --test packages/cli/src/budget.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseBudgetFlag, loadBudgetFile, resolveBudget,
  evaluateBudget, evaluateAll, formatValue, describeFailure, BUDGET_KEYS,
} from './budget.js';

/** A passing run: perfect score, quick paint, no shifting. */
const good = { scores: { performance: 95 }, metrics: { lcp: 1200, tbt: 50, cls: 0.01, fcp: 800, tti: 1500 } };
/** The same page having a bad day. */
const bad  = { scores: { performance: 41 }, metrics: { lcp: 4800, tbt: 900, cls: 0.31, fcp: 2600, tti: 6000 } };

// ─── Flag parsing ────────────────────────────────────────────────────────────

test('parseBudgetFlag reads comma-separated pairs', () => {
  assert.deepEqual(parseBudgetFlag('performance=80,lcp=2500'), { performance: 80, lcp: 2500 });
});

test('parseBudgetFlag tolerates spacing and trailing commas', () => {
  assert.deepEqual(parseBudgetFlag(' performance = 80 , lcp=2500, '), { performance: 80, lcp: 2500 });
});

test('parseBudgetFlag accepts a fractional CLS', () => {
  assert.deepEqual(parseBudgetFlag('cls=0.1'), { cls: 0.1 });
});

test('parseBudgetFlag rejects a non-numeric or negative threshold', () => {
  // A typo silently ignored would mean a build that never fails — louder is safer.
  assert.throws(() => parseBudgetFlag('lcp=fast'), /Invalid budget/);
  assert.throws(() => parseBudgetFlag('lcp=-1'),   /Invalid budget/);
});

// ─── Evaluation ──────────────────────────────────────────────────────────────

test('performance is a floor, the rest are ceilings', () => {
  assert.deepEqual(evaluateBudget(good, { performance: 80, lcp: 2500 }), []);

  const failures = evaluateBudget(bad, { performance: 80, lcp: 2500 });
  assert.deepEqual(failures.map(f => f.metric).sort(), ['lcp', 'performance']);
  assert.equal(failures.find(f => f.metric === 'performance').kind, 'floor');
  assert.equal(failures.find(f => f.metric === 'lcp').kind, 'ceiling');
});

test('a threshold met exactly passes', () => {
  // Budgets are written as "at least"/"at most", so the boundary must not fail a build.
  assert.deepEqual(evaluateBudget({ scores: { performance: 80 }, metrics: {} }, { performance: 80 }), []);
  assert.deepEqual(evaluateBudget({ scores: {}, metrics: { lcp: 2500 } }, { lcp: 2500 }), []);
});

test('a metric missing from the run is skipped, not failed', () => {
  // Categories the run did not measure would otherwise fail every budget by default.
  assert.deepEqual(evaluateBudget({ scores: {}, metrics: {} }, { performance: 80, lcp: 2500 }), []);
});

test('evaluateAll reports every threshold, including the ones that passed', () => {
  const rows = evaluateAll(bad, { performance: 80, lcp: 2500, cls: 0.5 });
  assert.equal(rows.length, 3);
  assert.equal(rows.find(r => r.metric === 'cls').passed, true);
  assert.equal(rows.find(r => r.metric === 'lcp').passed, false);
});

test('evaluateAll marks an unmeasured metric null rather than passed', () => {
  const [row] = evaluateAll({ scores: {}, metrics: {} }, { lcp: 2500 });
  assert.equal(row.passed, null);
});

// ─── Formatting ──────────────────────────────────────────────────────────────

test('formatValue uses the unit a human would read', () => {
  assert.equal(formatValue('lcp', 950),  '950ms');
  assert.equal(formatValue('lcp', 2500), '2.50s');   // seconds once it passes 1000ms
  assert.equal(formatValue('cls', 0.1),  '0.100');
  assert.equal(formatValue('performance', 80.6), '81');
});

test('describeFailure states the comparator the budget actually used', () => {
  const [perf] = evaluateBudget(bad, { performance: 80 });
  assert.equal(describeFailure(perf), 'Performance score 41 (budget ≥ 80)');

  const [lcp] = evaluateBudget(bad, { lcp: 2500 });
  assert.equal(describeFailure(lcp), 'LCP 4.80s (budget ≤ 2.50s)');
});

// ─── Files ───────────────────────────────────────────────────────────────────

test('loadBudgetFile accepts a top-level or a nested budget object', () => {
  const dir = mkdtempSync(join(tmpdir(), 'perfscope-budget-'));
  try {
    const flat = join(dir, 'flat.json');
    writeFileSync(flat, JSON.stringify({ performance: 80, lcp: 2500 }));
    assert.deepEqual(loadBudgetFile(flat), { performance: 80, lcp: 2500 });

    const nested = join(dir, 'nested.json');
    writeFileSync(nested, JSON.stringify({ budget: { performance: 90 } }));
    assert.deepEqual(loadBudgetFile(nested), { performance: 90 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadBudgetFile ignores keys that are not budget metrics', () => {
  // Config files grow other settings; unknown keys must not become thresholds.
  const dir = mkdtempSync(join(tmpdir(), 'perfscope-budget-'));
  try {
    const p = join(dir, 'perfscope.json');
    writeFileSync(p, JSON.stringify({ performance: 80, apiUrl: 'https://example.com', nonsense: 1 }));
    assert.deepEqual(Object.keys(loadBudgetFile(p)), ['performance']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveBudget discovers perfscope.json and lets flags override it per key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'perfscope-budget-'));
  try {
    writeFileSync(join(dir, 'perfscope.json'), JSON.stringify({ performance: 80, lcp: 2500 }));

    const discovered = resolveBudget({ cwd: dir });
    assert.deepEqual(discovered.budget, { performance: 80, lcp: 2500 });
    assert.ok(discovered.sourceFile?.endsWith('perfscope.json'));

    // The flag replaces only the key it names; the rest of the file survives.
    const overridden = resolveBudget({ budget: 'performance=95', cwd: dir });
    assert.deepEqual(overridden.budget, { performance: 95, lcp: 2500 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveBudget with no file and no flag yields an empty budget', () => {
  const dir = mkdtempSync(join(tmpdir(), 'perfscope-budget-'));
  try {
    const { budget, sourceFile } = resolveBudget({ cwd: dir });
    assert.deepEqual(budget, {});
    assert.equal(sourceFile, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Contract with the backend ───────────────────────────────────────────────

test('BUDGET_KEYS still covers what budget.service.ts checks', () => {
  // This module is a deliberate copy of collectFailures() in the backend; if that grows a
  // metric and this list does not, `perfscope ci` silently stops enforcing it.
  assert.deepEqual([...BUDGET_KEYS].sort(), ['cls', 'fcp', 'lcp', 'performance', 'tbt', 'tti']);
});
