/**
 * Running a scoring probe more than once, in a fresh process each time.
 *
 * Fresh matters: `generate()` caches by prompt for six hours, so a second identical run
 * inside one process returns the identical text and measures nothing. The child boundary
 * is the cache boundary.
 *
 * Both probes that repeat a measurement use this — `ai-quality` across runs of one model,
 * `model-tier` across models — so the parsing and the averaging cannot drift apart.
 */
import { spawnSync } from 'node:child_process';

export const RESULT_PREFIX = '##RESULT##';

export interface ScoredRow {
  model: string; url: string; fixtures?: number;
  fixes: number; concrete: number;
  auditsConcrete: number; auditsTotal: number;
  diagnosisChars: number; elapsedMs: number; inTokens: number; outTokens: number;
  /** Per-fixture detail, so a repeat can say which page is the unstable one. */
  rows?: { name: string; fixes: number; concrete: number; citable: number }[];
}

/** One scored run, or `null` with the child's last words printed. */
export function spawnScored(
  script: string, args: string[], opts: { cwd: string; env?: Record<string, string> },
): ScoredRow | null {
  const child = spawnSync('npx', ['tsx', script, ...args, '--json'], {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    encoding: 'utf8',
    timeout: 600_000,
  });
  const line = (child.stdout ?? '').split('\n').find(l => l.startsWith(RESULT_PREFIX));
  if (!line) {
    console.log('FAILED');
    console.log((child.stderr || child.stdout || '(no output)').trim().split('\n').slice(-4).join('\n'));
    return null;
  }
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as ScoredRow;
}

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** Mean plus the range, because on a page with little to cite the range is the story. */
export function stats(xs: number[]): { mean: number; min: number; max: number } {
  return { mean: mean(xs), min: Math.min(...xs), max: Math.max(...xs) };
}
