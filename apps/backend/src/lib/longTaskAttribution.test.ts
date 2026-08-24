import { describe, it, expect } from 'vitest';
import { attributeLongTasks, type AttributableResource } from './longTaskAttribution.js';

const res = (over: Partial<AttributableResource> = {}): AttributableResource =>
  ({ url: 'https://a.test/app.js', resourceType: 'script', transferSize: 100_000, startTime: 100, endTime: 400, ...over });

describe('attributeLongTasks — direct attribution', () => {
  it('keeps the script the trace itself named, and resolves its size', () => {
    // A 3KB inline handler and a 400KB bundle are different findings even under the same
    // file name, so the size is worth looking up even when the cause is already certain.
    const [task] = attributeLongTasks(
      [{ name: 'Evaluate Script', startMs: 200, durationMs: 120, url: 'https://a.test/app.js' }],
      [res()],
    );
    expect(task?.url).toBe('https://a.test/app.js');
    expect(task?.resource).toEqual({ url: 'https://a.test/app.js', resourceType: 'script', transferSize: 100_000, direct: true });
  });

  it('keeps the direct URL even when no matching resource was captured', () => {
    const [task] = attributeLongTasks(
      [{ name: 'Evaluate Script', startMs: 200, durationMs: 120, url: 'https://cdn.test/unknown.js' }],
      [res()],
    );
    expect(task?.url).toBe('https://cdn.test/unknown.js');
    expect(task?.resource).toBeUndefined();
  });
});

describe('attributeLongTasks — inferred attribution', () => {
  it('picks the heaviest script whose window overlaps the task', () => {
    // Parse/compile/execute cost scales with size, so the biggest overlapping script is
    // the most plausible single cause — but it is a guess, which is what `direct: false`
    // is for: callers must say "likely", never state it as fact.
    const [task] = attributeLongTasks(
      [{ name: 'Task', startMs: 200, durationMs: 100 }],
      [
        res({ url: 'https://a.test/small.js', transferSize: 10_000 }),
        res({ url: 'https://a.test/big.js',   transferSize: 900_000 }),
      ],
    );
    expect(task?.resource).toMatchObject({ url: 'https://a.test/big.js', direct: false });
    expect(task?.url).toBeUndefined();
  });

  it('ignores resources that are not scripts', () => {
    const [task] = attributeLongTasks(
      [{ name: 'Task', startMs: 200, durationMs: 100 }],
      [res({ url: 'https://a.test/hero.jpg', resourceType: 'image', transferSize: 2_000_000 })],
    );
    expect(task?.resource).toBeUndefined();
  });

  it('requires a real overlap, not merely being nearby', () => {
    const before = res({ startTime: 0,   endTime: 200 });   // ends exactly as the task starts
    const after  = res({ startTime: 300, endTime: 500 });   // starts exactly as the task ends
    const tasks  = [{ name: 'Task', startMs: 200, durationMs: 100 }];

    expect(attributeLongTasks(tasks, [before])[0]?.resource).toBeUndefined();
    expect(attributeLongTasks(tasks, [after])[0]?.resource).toBeUndefined();
    expect(attributeLongTasks(tasks, [res({ startTime: 250, endTime: 260 })])[0]?.resource).toBeDefined();
  });

  it('leaves a task unattributed rather than blaming the nearest thing', () => {
    const [task] = attributeLongTasks([{ name: 'Layout', startMs: 900, durationMs: 80 }], [res()]);
    expect(task).toEqual({ name: 'Layout', startMs: 900, durationMs: 80 });
  });
});
