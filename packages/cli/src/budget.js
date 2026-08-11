import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Budget evaluation for `perfscope ci`.
 *
 * Mirrors collectFailures() in apps/backend/src/services/budget.service.ts. The CLI is
 * published to npm on its own and deliberately has no workspace dependencies, so the
 * predicate is duplicated rather than imported — keep the two in sync when either moves.
 */

/** Config file looked up in the working directory when --budget-file is omitted. */
export const DEFAULT_BUDGET_FILES = ['perfscope.json', '.perfscope.json'];

/** performance is a floor (score must stay above); the rest are ceilings. */
const METRICS = {
  performance: { kind: 'floor',   source: 'scores',  label: 'Performance score' },
  lcp:         { kind: 'ceiling', source: 'metrics', label: 'LCP', unit: 'ms' },
  tbt:         { kind: 'ceiling', source: 'metrics', label: 'TBT', unit: 'ms' },
  cls:         { kind: 'ceiling', source: 'metrics', label: 'CLS' },
  fcp:         { kind: 'ceiling', source: 'metrics', label: 'FCP', unit: 'ms' },
  tti:         { kind: 'ceiling', source: 'metrics', label: 'TTI', unit: 'ms' },
};

export const BUDGET_KEYS = Object.keys(METRICS);

function parseThreshold(key, raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid budget for "${key}": ${raw}`);
  }
  return n;
}

/** `--budget performance=80,lcp=2500` */
export function parseBudgetFlag(spec) {
  const budget = {};
  for (const pair of String(spec).split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;

    const [key, value] = trimmed.split('=').map(s => s?.trim());
    if (!key || value === undefined) {
      throw new Error(`Malformed budget "${trimmed}" — expected key=value`);
    }
    if (!(key in METRICS)) {
      throw new Error(`Unknown budget "${key}". Valid keys: ${BUDGET_KEYS.join(', ')}`);
    }
    budget[key] = parseThreshold(key, value);
  }
  return budget;
}

/**
 * Reads a budget file. Accepts either the thresholds at the top level or nested under
 * a "budget"/"budgets" key, so the same file can carry other project config.
 */
export function loadBudgetFile(filePath) {
  const abs = resolve(filePath);
  if (!existsSync(abs)) throw new Error(`Budget file not found: ${abs}`);

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new Error(`Could not parse ${abs}: ${err.message}`);
  }

  const raw = parsed?.budget ?? parsed?.budgets ?? parsed;
  if (!raw || typeof raw !== 'object') throw new Error(`No budget object in ${abs}`);

  const budget = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in METRICS)) continue;  // ignore unrelated config keys
    if (value == null) continue;
    budget[key] = parseThreshold(key, value);
  }
  return budget;
}

/**
 * Explicit --budget-file wins over auto-discovery; inline --budget flags override
 * individual keys from the file so CI can tighten one metric without a new file.
 */
export function resolveBudget({ budget, budgetFile, cwd = process.cwd() }) {
  let fromFile = {};
  let sourceFile = null;

  if (budgetFile) {
    fromFile = loadBudgetFile(budgetFile);
    sourceFile = resolve(budgetFile);
  } else {
    for (const candidate of DEFAULT_BUDGET_FILES) {
      const abs = resolve(cwd, candidate);
      if (existsSync(abs)) {
        fromFile = loadBudgetFile(abs);
        sourceFile = abs;
        break;
      }
    }
  }

  const fromFlag = budget ? parseBudgetFlag(budget) : {};
  return { budget: { ...fromFile, ...fromFlag }, sourceFile };
}

function readValue(result, key) {
  const { source } = METRICS[key];
  const value = result?.[source]?.[key];
  return typeof value === 'number' ? value : null;
}

/** @returns {{ metric, value, budget, kind }[]} — empty when every threshold passes. */
export function evaluateBudget(result, budget) {
  const failures = [];
  for (const [metric, threshold] of Object.entries(budget)) {
    const value = readValue(result, metric);
    if (value == null) continue;  // metric absent from this run — nothing to assert

    const { kind } = METRICS[metric];
    const failed = kind === 'floor' ? value < threshold : value > threshold;
    if (failed) failures.push({ metric, value, budget: threshold, kind });
  }
  return failures;
}

export function formatValue(metric, value) {
  const { unit } = METRICS[metric] ?? {};
  if (metric === 'cls') return value.toFixed(3);
  if (metric === 'performance') return String(Math.round(value));
  if (unit === 'ms') return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
  return String(value);
}

export function labelOf(metric) {
  return METRICS[metric]?.label ?? metric.toUpperCase();
}

/** "Performance score 41 (budget ≥ 80)" */
export function describeFailure(f) {
  const comparator = f.kind === 'floor' ? '≥' : '≤';
  return `${labelOf(f.metric)} ${formatValue(f.metric, f.value)} (budget ${comparator} ${formatValue(f.metric, f.budget)})`;
}

/** Every checked threshold with its verdict — used for the pass table and CI summary. */
export function evaluateAll(result, budget) {
  return Object.entries(budget).map(([metric, threshold]) => {
    const value = readValue(result, metric);
    const { kind } = METRICS[metric];
    const passed = value == null ? null : (kind === 'floor' ? value >= threshold : value <= threshold);
    return { metric, value, budget: threshold, kind, passed };
  });
}
