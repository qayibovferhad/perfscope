import { describe, it, expect } from 'vitest';
import { fmtMs, fmtMsOrDash, fmtSec, fmtCls, fmtBytes, fmtBytesOrDash } from './format';
import { normalizeUrl } from './utils';

describe('fmtMs', () => {
  it('rounds below a second, two decimals above', () => {
    expect(fmtMs(0)).toBe('0ms');
    expect(fmtMs(123.6)).toBe('124ms');
    expect(fmtMs(999)).toBe('999ms');
    expect(fmtMs(1000)).toBe('1.00s');
    expect(fmtMs(2345)).toBe('2.35s');
  });
});

describe('fmtMsOrDash', () => {
  it('dashes non-durations', () => {
    expect(fmtMsOrDash(0)).toBe('—');
    expect(fmtMsOrDash(-5)).toBe('—');
    expect(fmtMsOrDash(80)).toBe('80ms');
  });
});

describe('fmtSec', () => {
  it('always renders seconds with one decimal', () => {
    expect(fmtSec(100)).toBe('0.1s');
    expect(fmtSec(2500)).toBe('2.5s');
  });
});

describe('fmtCls', () => {
  it('uses three decimals', () => {
    expect(fmtCls(0)).toBe('0.000');
    expect(fmtCls(0.1)).toBe('0.100');
  });
});

describe('fmtBytes', () => {
  it('scales B → KB → MB', () => {
    expect(fmtBytes(0)).toBe('0 B');
    expect(fmtBytes(1023)).toBe('1023 B');
    expect(fmtBytes(1024)).toBe('1.0 KB');
    expect(fmtBytes(1_048_576)).toBe('1.0 MB');
    expect(fmtBytesOrDash(0)).toBe('—');
  });
});

describe('normalizeUrl', () => {
  it('trims and defaults to https://', () => {
    expect(normalizeUrl('  example.com ')).toBe('https://example.com');
    expect(normalizeUrl('http://a.dev')).toBe('http://a.dev');
    expect(normalizeUrl('https://a.dev')).toBe('https://a.dev');
  });
});
