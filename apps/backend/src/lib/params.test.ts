import { describe, it, expect } from 'vitest';
import { parseFormFactor, intParam } from './params.js';
import { meanRounded } from './stats.js';

describe('parseFormFactor', () => {
  it('passes through the two real values', () => {
    expect(parseFormFactor('mobile')).toBe('mobile');
    expect(parseFormFactor('desktop')).toBe('desktop');
  });

  it('answers undefined for anything else, leaving the default to the caller', () => {
    // The defaults genuinely differ per caller — CrUX reads as mobile, a RUM beacon as
    // desktop, the website list as "both" — which is why this never invents one.
    for (const junk of ['MOBILE', 'tablet', '', null, undefined, 1, {}]) {
      expect(parseFormFactor(junk)).toBeUndefined();
    }
  });
});

describe('intParam', () => {
  it('reads an integer from a query string', () => {
    expect(intParam('7', { def: 1 })).toBe(7);
    expect(intParam(7, { def: 1 })).toBe(7);
  });

  it('clamps into range rather than rejecting', () => {
    expect(intParam('999', { def: 30, min: 1, max: 90 })).toBe(90);
    expect(intParam('0', { def: 30, min: 1, max: 90 })).toBe(1);
  });

  it('falls back to the default for junk and absence — and clamps that too', () => {
    expect(intParam(undefined, { def: 30, min: 1, max: 90 })).toBe(30);
    expect(intParam('abc', { def: 30, min: 1, max: 90 })).toBe(30);
    expect(intParam(null, { def: 30, min: 1, max: 90 })).toBe(30);
    // A default outside the caller's own bounds is a caller bug; clamping it is still
    // better than answering with a value the endpoint says it will never return.
    expect(intParam('abc', { def: 500, min: 1, max: 90 })).toBe(90);
  });

  it('takes the leading integer of a decimal, as parseInt does', () => {
    expect(intParam('7.9', { def: 1 })).toBe(7);
  });
});

describe('meanRounded', () => {
  it('rounds the mean', () => {
    expect(meanRounded([90, 91])).toBe(91);   // 90.5 rounds up
    expect(meanRounded([80, 90, 100])).toBe(90);
  });

  it('is null for an empty set, never 0', () => {
    // "No audits yet" and "audited, and it scored zero" are opposite claims. Callers that
    // want a zero write `?? 0`, which puts that decision somewhere a reader can see it.
    expect(meanRounded([])).toBeNull();
    expect(meanRounded([0])).toBe(0);
  });
});
