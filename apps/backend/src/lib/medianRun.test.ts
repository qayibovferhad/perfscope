import { describe, it, expect } from 'vitest';
import type { RunnerResult } from 'lighthouse';
import { pickMedianRun } from './medianRun.js';

/** A run, identified by a label so the test can assert *which* one came back. */
const run = (label: string, score: number) =>
  ({ label, lhr: { categories: { performance: { score: score / 100 } } } as unknown as RunnerResult['lhr'] });

describe('pickMedianRun', () => {
  it('returns a whole run, not a synthesised one', () => {
    // The waterfall, filmstrip and trace beside the score have to belong to the same load.
    // Averaging the metrics would describe a page load that never happened.
    const runs = [run('a', 70), run('b', 90), run('c', 80)];
    expect(pickMedianRun(runs).run).toBe(runs[2]);   // 80 is the median of 70/80/90
  });

  it('reports the spread and the scores in the order they were measured', () => {
    const { measurement } = pickMedianRun([run('a', 70), run('b', 90), run('c', 80)]);
    expect(measurement).toEqual({ runs: 3, scores: [70, 90, 80], median: 80, spread: 20 });
  });

  it('takes the lower of the middle pair on an even count', () => {
    // Adaptive run counts make two-run audits ordinary, and this makes such an audit report
    // the worse of the two. Deliberate: they are within STABLE_SPREAD by then, and a
    // measuring tool that rounds towards flattering itself is worse than one that does not.
    const runs = [run('slow', 78), run('fast', 82)];
    expect(pickMedianRun(runs).run).toBe(runs[0]);
    expect(pickMedianRun(runs).measurement.median).toBe(78);
  });

  it('handles a single run — spread zero, not undefined', () => {
    const runs = [run('only', 91)];
    expect(pickMedianRun(runs)).toMatchObject({ run: runs[0], measurement: { runs: 1, median: 91, spread: 0 } });
  });

  it('reads a run with no performance category as zero', () => {
    // A run whose performance category never produced a score is a failed run, and a failed
    // run must not be picked over one that worked.
    const runs = [{ label: 'broken', lhr: { categories: {} } as unknown as RunnerResult['lhr'] }, run('good', 90)];
    expect(pickMedianRun(runs)).toMatchObject({ run: runs[0], measurement: { scores: [0, 90], spread: 90 } });
  });
});
