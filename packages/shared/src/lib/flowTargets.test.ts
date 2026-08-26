import { describe, it, expect } from 'vitest';
import { collectFlowTargetFailures } from '../types/flow';
import type { FlowStepResult } from '../types/flow';

const step = (
  name: string,
  mode: FlowStepResult['mode'],
  metrics: FlowStepResult['metrics'],
): Pick<FlowStepResult, 'name' | 'mode' | 'metrics'> => ({ name, mode, metrics });

describe('collectFlowTargetFailures', () => {
  it('reports a target the run missed, with the step that missed it', () => {
    const failures = collectFlowTargetFailures(
      [step('Open the panel', 'timespan', { inp: 340, tbt: 260 })],
      { inp: 200 },
    );
    expect(failures).toEqual([{ metric: 'inp', step: 'Open the panel', value: 340, target: 200 }]);
  });

  it('judges the worst step, not the average', () => {
    // A flow whose second click takes 900ms has a problem; averaging it with four fast ones
    // is exactly how that disappears from a report.
    const failures = collectFlowTargetFailures(
      [
        step('Fast', 'timespan', { inp: 60 }),
        step('Slow', 'timespan', { inp: 900 }),
        step('Also fast', 'timespan', { inp: 70 }),
      ],
      { inp: 200 },
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ step: 'Slow', value: 900 });
  });

  it('is quiet when every step is inside the target', () => {
    expect(collectFlowTargetFailures([step('Open', 'timespan', { inp: 120 })], { inp: 200 })).toEqual([]);
    // Exactly on the number is met, like every other threshold in the product.
    expect(collectFlowTargetFailures([step('Open', 'timespan', { inp: 200 })], { inp: 200 })).toEqual([]);
  });

  it('ignores the navigation and the snapshot', () => {
    // The cold load is an ordinary audit and the site's own budget already covers it; a
    // snapshot has no timing at all. Counting either would hold a flow to a number it does
    // not measure.
    const failures = collectFlowTargetFailures(
      [
        step('Page load', 'navigation', { tbt: 800, cls: 0.4 }),
        step('Final state', 'snapshot', {}),
      ],
      { tbt: 100, cls: 0.1 },
    );
    expect(failures).toEqual([]);
  });

  it('skips a metric the run never measured', () => {
    // CLS with no layout shift is 0, but a metric that is *absent* is not zero — and a
    // target on it must not fire on nothing.
    expect(collectFlowTargetFailures([step('Open', 'timespan', { inp: 90 })], { cls: 0.1 })).toEqual([]);
  });

  it('ignores targets that are not set', () => {
    expect(collectFlowTargetFailures([step('Open', 'timespan', { inp: 900 })], undefined)).toEqual([]);
    expect(collectFlowTargetFailures([step('Open', 'timespan', { inp: 900 })], {})).toEqual([]);
    // Null is how the form clears one, and zero is not a threshold anybody means.
    expect(collectFlowTargetFailures([step('Open', 'timespan', { inp: 900 })], { inp: null })).toEqual([]);
    expect(collectFlowTargetFailures([step('Open', 'timespan', { inp: 900 })], { inp: 0 })).toEqual([]);
  });

  it('reports every metric that missed, in a stable order', () => {
    const failures = collectFlowTargetFailures(
      [step('Open', 'timespan', { inp: 400, tbt: 500, cls: 0.3 })],
      { inp: 200, tbt: 300, cls: 0.1 },
    );
    expect(failures.map(f => f.metric)).toEqual(['inp', 'tbt', 'cls']);
  });
});
