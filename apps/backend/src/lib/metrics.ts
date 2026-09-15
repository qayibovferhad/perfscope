/**
 * Counters and gauges, in Prometheus' text format, from scratch.
 *
 * No client library: what this server has to report is a dozen numbers it already keeps —
 * requests, audits, the queue — and `prom-client` would be a dependency, a registry
 * abstraction and a set of default collectors to answer a question that fits in a hundred
 * lines. The exposition format is text and stable; the risk here is not the format.
 *
 * Deliberately not persisted and not aggregated: these are process counters, they reset
 * when the container restarts, and that is what a scraper expects — it computes rates from
 * the difference and handles the reset itself.
 */

type Labels = Record<string, string>;

interface Series {
  help:   string;
  type:   'counter' | 'gauge';
  values: Map<string, { labels: Labels; value: number }>;
}

const series = new Map<string, Series>();

function keyOf(labels: Labels): string {
  return Object.keys(labels).sort().map(k => `${k}=${labels[k]}`).join(',');
}

function seriesFor(name: string, help: string, type: 'counter' | 'gauge'): Series {
  let s = series.get(name);
  if (!s) { s = { help, type, values: new Map() }; series.set(name, s); }
  return s;
}

/** Add to a counter — a number that only ever goes up within one process lifetime. */
export function increment(name: string, help: string, labels: Labels = {}, by = 1): void {
  const s = seriesFor(name, help, 'counter');
  const key = keyOf(labels);
  const existing = s.values.get(key);
  if (existing) existing.value += by;
  else s.values.set(key, { labels, value: by });
}

/** Set a gauge — a number that describes right now, and may go down. */
export function setGauge(name: string, help: string, value: number, labels: Labels = {}): void {
  const s = seriesFor(name, help, 'gauge');
  s.values.set(keyOf(labels), { labels, value });
}

/**
 * Set a counter to a value somebody else is already counting.
 *
 * For tallies this module does not own — the AI client keeps its own per-call token totals
 * and they are the authority. Re-counting them here would be a second number to disagree
 * with the first.
 */
export function setCounterTo(name: string, help: string, value: number, labels: Labels = {}): void {
  const s = seriesFor(name, help, 'counter');
  s.values.set(keyOf(labels), { labels, value });
}

/**
 * A duration, as a `_count` and a `_sum` pair rather than a histogram.
 *
 * Buckets are what a histogram is *for* — percentiles — and choosing them for an audit
 * that takes between fifteen seconds and four minutes, without knowing what anyone wants
 * to ask, would be guessing. The pair gives a mean and a rate, which is what these numbers
 * are actually read for; the audit's own timings are measured properly by the product.
 */
export function observeDuration(name: string, help: string, seconds: number, labels: Labels = {}): void {
  increment(`${name}_count`, `${help} (number of observations)`, labels);
  increment(`${name}_sum`, `${help} (total seconds)`, labels, seconds);
}

/**
 * Filled in at scrape time rather than continuously — the queue's depth and the process's
 * memory are only interesting when somebody asks, and a setInterval updating them would
 * keep a timer alive to answer a question nobody may ever put.
 */
type Collector = () => void;
const collectors: Collector[] = [];

export function registerCollector(fn: Collector): void {
  collectors.push(fn);
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** The whole registry, in the format a scraper reads. */
export function renderMetrics(): string {
  for (const collect of collectors) {
    // One broken collector must not empty the whole scrape.
    try { collect(); } catch { /* reported by whatever it was reading */ }
  }

  const lines: string[] = [];
  for (const [name, s] of [...series.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`# HELP ${name} ${s.help}`);
    lines.push(`# TYPE ${name} ${s.type}`);
    for (const { labels, value } of s.values.values()) {
      const rendered = Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}="${escapeLabel(v)}"`)
        .join(',');
      lines.push(`${name}${rendered ? `{${rendered}}` : ''} ${value}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Only for tests: start from an empty registry. */
export function resetMetrics(): void {
  series.clear();
  collectors.length = 0;
}
