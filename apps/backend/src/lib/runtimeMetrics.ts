import { setGauge, setCounterTo, registerCollector } from './metrics.js';
import { auditQueue } from '../services/lighthouse.service.js';
import { aiUsageSnapshot } from '../services/ai/client.js';
import { isDbReady } from '../config/database.js';
import { config } from '../config/index.js';

/**
 * The numbers this server already keeps, read at scrape time.
 *
 * Separate from `lib/metrics.ts` so that module stays a registry with no idea what a
 * PerfScope is — and separate from the services so none of them has to import a metrics
 * module to be measured. Everything here is a *read* of state that exists anyway; nothing
 * is counted twice.
 */
export function registerRuntimeCollectors(): void {
  registerCollector(() => {
    // The queue. Depth is the number that answers "why is my audit not starting" — and the
    // cap beside it is what says whether the answer is "the server is busy" or
    // "MAX_CONCURRENT_AUDITS is 2".
    const { running, queued, maxConcurrent } = auditQueue.stats;
    setGauge('perfscope_audit_queue_running', 'Audits and flows holding a slot right now', running);
    setGauge('perfscope_audit_queue_queued', 'Audits and flows waiting for a slot', queued);
    setGauge('perfscope_audit_queue_max', 'Configured concurrency cap (MAX_CONCURRENT_AUDITS)', maxConcurrent);

    const mem = process.memoryUsage();
    setGauge('perfscope_process_uptime_seconds', 'Seconds since this process started', Math.round(process.uptime()));
    setGauge('perfscope_process_resident_bytes', 'Resident set size', mem.rss);
    setGauge('perfscope_process_heap_used_bytes', 'V8 heap in use', mem.heapUsed);

    // A degradation, not an outage — the app serves empty shapes without Mongo on purpose
    // — but it is the difference between "history is empty" and "history is gone".
    setGauge('perfscope_database_up', 'Whether MongoDB is currently connected (1 or 0)', isDbReady() ? 1 : 0);

    // One series whose value is always 1, carrying the build as labels. The standard way to
    // make "which version is running" joinable onto every other series in a query.
    setGauge('perfscope_build_info', 'Build and environment of the running process', 1, {
      version:     config.appVersion,
      environment: config.nodeEnv,
    });

    // The AI client keeps its own per-call tallies; these are that same count, exposed.
    for (const [call, tally] of Object.entries(aiUsageSnapshot())) {
      setCounterTo('perfscope_ai_calls_total', 'Gemini calls made', tally.calls, { call });
      setCounterTo('perfscope_ai_cache_hits_total', 'Gemini calls answered from the prompt cache', tally.cacheHits, { call });
      setCounterTo('perfscope_ai_retries_total', 'Gemini calls retried', tally.retries, { call });
      setCounterTo('perfscope_ai_failures_total', 'Gemini calls that failed after the retry', tally.failures, { call });
      setCounterTo('perfscope_ai_tokens_total', 'Gemini tokens', tally.inTokens, { call, direction: 'in' });
      setCounterTo('perfscope_ai_tokens_total', 'Gemini tokens', tally.outTokens, { call, direction: 'out' });
    }
  });
}
