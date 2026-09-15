import { describe, it, expect, beforeEach } from 'vitest';
import { increment, setGauge, setCounterTo, observeDuration, registerCollector, renderMetrics, resetMetrics } from './metrics.js';

describe('metrics', () => {
  beforeEach(() => resetMetrics());

  it('renders HELP and TYPE before each series', () => {
    increment('perfscope_runs_total', 'Audits and flows executed', { kind: 'audit', result: 'ok' });
    const out = renderMetrics();
    expect(out).toContain('# HELP perfscope_runs_total Audits and flows executed');
    expect(out).toContain('# TYPE perfscope_runs_total counter');
    expect(out).toContain('perfscope_runs_total{kind="audit",result="ok"} 1');
  });

  it('adds to a counter per label set, keeping them apart', () => {
    increment('c', 'h', { kind: 'audit' });
    increment('c', 'h', { kind: 'audit' });
    increment('c', 'h', { kind: 'flow' });
    const out = renderMetrics();
    expect(out).toContain('c{kind="audit"} 2');
    expect(out).toContain('c{kind="flow"} 1');
  });

  it('treats label order as irrelevant rather than as a different series', () => {
    increment('c', 'h', { a: '1', b: '2' });
    increment('c', 'h', { b: '2', a: '1' });
    expect(renderMetrics()).toContain('c{a="1",b="2"} 2');
  });

  it('lets a gauge go down, unlike a counter', () => {
    setGauge('q', 'h', 5);
    setGauge('q', 'h', 2);
    expect(renderMetrics()).toContain('q 2');
  });

  it('records a duration as a count and a sum, not a histogram', () => {
    observeDuration('d', 'h', 1.5, { kind: 'audit' });
    observeDuration('d', 'h', 2.5, { kind: 'audit' });
    const out = renderMetrics();
    expect(out).toContain('d_count{kind="audit"} 2');
    expect(out).toContain('d_sum{kind="audit"} 4');
  });

  it('takes a foreign tally at its own word', () => {
    setCounterTo('ai', 'h', 17, { call: 'insights' });
    setCounterTo('ai', 'h', 19, { call: 'insights' });
    expect(renderMetrics()).toContain('ai{call="insights"} 19');
  });

  it('runs collectors at scrape time, and one failing does not empty the scrape', () => {
    registerCollector(() => { throw new Error('a service is down'); });
    registerCollector(() => setGauge('late', 'h', 1));
    expect(renderMetrics()).toContain('late 1');
  });

  it('escapes a label value rather than producing an unparseable line', () => {
    setGauge('build', 'h', 1, { version: 'v1"odd\\path' });
    expect(renderMetrics()).toContain('build{version="v1\\"odd\\\\path"} 1');
  });
});
