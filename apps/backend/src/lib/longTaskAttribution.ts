/**
 * Which resource actually caused a long task — root-cause chaining, not just a list of
 * unrelated facts. `analysePage`'s context used to print long tasks and resources as two
 * independent sections; the model had to guess whether any of them were related. They
 * often are: a long task is frequently a script parsing or executing right after it
 * finished downloading.
 *
 * Two attribution paths, and the prompt must be able to tell them apart:
 *   1. Direct — the trace event itself named a script (`FlameChartEvent.url`, set by
 *      `flame-chart-parser.ts` from the V8 profiler's own stack data). Certain.
 *   2. Inferred — no direct attribution, but a script resource's [startTime, endTime]
 *      window overlaps the task's [startMs, startMs+durationMs] window. Plausible, not
 *      proven — two things can simply coincide in time. Callers must say "likely", never
 *      state it as fact.
 */

export interface AttributableTask {
  name:       string
  startMs:    number
  durationMs: number
  /** Set when the trace event itself named a script — direct attribution. */
  url?:       string
}

export interface AttributableResource {
  url:          string
  resourceType: string
  transferSize: number
  /** Milliseconds from navigation start. */
  startTime:    number
  endTime:      number
}

export interface AttributedTask {
  name:       string
  startMs:    number
  durationMs: number
  /** Present only for direct attribution. */
  url?: string
  /** The best candidate resource, direct or inferred — absent when neither exists. */
  resource?: { url: string; resourceType: string; transferSize: number; direct: boolean }
}

export function attributeLongTasks(
  tasks: AttributableTask[],
  resources: AttributableResource[],
): AttributedTask[] {
  const byUrl = new Map(resources.map(r => [r.url, r]));

  return tasks.map(task => {
    // Direct: the trace already named the script. Still worth resolving its size — a
    // 3KB inline handler and a 400KB bundle are very different findings even with the
    // same file name.
    if (task.url) {
      const match = byUrl.get(task.url);
      return {
        name: task.name, startMs: task.startMs, durationMs: task.durationMs, url: task.url,
        ...(match ? { resource: { url: match.url, resourceType: match.resourceType, transferSize: match.transferSize, direct: true } } : {}),
      };
    }

    // Inferred: any script resource whose download/execution window overlaps this task.
    // Heaviest wins among candidates — parse/compile/execute cost scales with size, so
    // the biggest overlapping script is the most plausible single cause.
    const taskEnd = task.startMs + task.durationMs;
    const overlapping = resources.filter(r =>
      r.resourceType === 'script' && r.startTime < taskEnd && r.endTime > task.startMs);
    if (overlapping.length === 0) return { name: task.name, startMs: task.startMs, durationMs: task.durationMs };

    const best = [...overlapping].sort((a, b) => b.transferSize - a.transferSize)[0]!;
    return {
      name: task.name, startMs: task.startMs, durationMs: task.durationMs,
      resource: { url: best.url, resourceType: best.resourceType, transferSize: best.transferSize, direct: false },
    };
  });
}
