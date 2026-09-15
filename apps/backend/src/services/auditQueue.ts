import { increment, observeDuration } from '../lib/metrics.js';

export type AuditPriority = 'interactive' | 'background';

/** What is occupying a slot. Flows share this queue with audits — see flow.service. */
export type AuditKind = 'audit' | 'flow';

interface Waiter {
  priority: AuditPriority;
  /** Enqueue order, used as the tie-breaker so equal priorities stay FIFO. */
  seq:      number;
  admit:    () => void;
  onQueue?: ((position: number) => void) | undefined;
}

/**
 * Admission control for audits.
 *
 * Every audit owns at least one Chrome instance, so running them unbounded means
 * they starve each other's CPU — and a Lighthouse run that loses CPU does not
 * merely take longer, it *reports worse numbers*. Capping concurrency is
 * therefore a correctness feature, not just resource hygiene.
 *
 * A person waiting on a page outranks a nightly job, so interactive work jumps
 * ahead of background work; within the same priority the queue is FIFO.
 */
export class AuditQueue {
  private running = 0;
  private seq     = 0;
  private waiting: Waiter[] = [];

  constructor(private readonly maxConcurrent: number) {}

  get stats(): { running: number; queued: number; maxConcurrent: number } {
    return { running: this.running, queued: this.waiting.length, maxConcurrent: this.maxConcurrent };
  }

  /**
   * Run `task` once a slot is free. `onQueue` fires with the 1-based queue
   * position while waiting (and again whenever that position improves), so the
   * caller can tell the user why nothing is happening yet.
   */
  async run<T>(
    task: () => Promise<T>,
    opts: { priority?: AuditPriority; kind?: AuditKind; onQueue?: (position: number) => void } = {},
  ): Promise<T> {
    await this.acquire(opts.priority ?? 'interactive', opts.onQueue);

    // Counted here rather than at the four call sites: this is the one gate every audit
    // and every flow passes through, so a new entry point cannot forget to be measured.
    // The clock starts after admission — queue time is the queue's story, and mixing it
    // into the run time would make a busy server look like a slow one.
    const kind = opts.kind ?? 'audit';
    const startedAt = Date.now();
    try {
      const result = await task();
      increment('perfscope_runs_total', 'Audits and flows executed', { kind, result: 'ok' });
      return result;
    } catch (err) {
      increment('perfscope_runs_total', 'Audits and flows executed', { kind, result: 'error' });
      throw err;
    } finally {
      observeDuration('perfscope_run_duration_seconds', 'Audit and flow run duration', (Date.now() - startedAt) / 1000, { kind });
      this.release();
    }
  }

  private acquire(priority: AuditPriority, onQueue?: (position: number) => void): Promise<void> {
    // `running` is only ever mutated synchronously, here and in release(), so the
    // cap can never be exceeded by two acquires racing in the same tick.
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waiting.push({ priority, seq: this.seq++, admit: resolve, onQueue });
      this.sort();
      this.broadcastPositions();
    });
  }

  private release(): void {
    this.running--;
    const next = this.waiting.shift();
    if (next) {
      this.running++;
      next.admit();
    }
    this.broadcastPositions();
  }

  private sort(): void {
    this.waiting.sort((a, b) =>
      a.priority === b.priority
        ? a.seq - b.seq
        : a.priority === 'interactive' ? -1 : 1,
    );
  }

  private broadcastPositions(): void {
    this.waiting.forEach((w, i) => w.onQueue?.(i + 1));
  }
}
