import { describe, it, expect } from 'vitest';
import {
  isValidUrl,
  hostOf,
  pathOf,
  sameOrigin,
  normalizeUrl,
  escapeRegex,
  hostPrefixRegex,
  normalizedUrlHostRegex,
} from './url.js';

describe('isValidUrl', () => {
  it('accepts http and https', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('https://example.com/a?b=c#d')).toBe(true);
  });

  it('rejects other schemes and junk', () => {
    // A URL reaches Lighthouse and a fetch; file:// and javascript: are not pages to audit.
    for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'ftp://x.test', 'example.com', '']) {
      expect(isValidUrl(bad)).toBe(false);
    }
  });

  it('still accepts localhost — auditing a dev server is a first-class use', () => {
    expect(isValidUrl('http://localhost:5173/app')).toBe(true);
  });
});

describe('hostOf / pathOf', () => {
  it('reads the parts of a URL', () => {
    expect(hostOf('https://example.com:8443/a')).toBe('example.com');   // hostname, no port
    expect(pathOf('https://example.com/a/b?q=1')).toBe('/a/b');
  });

  it('degrades to a fallback instead of throwing', () => {
    // Every caller of these treats a bad URL as "no host" — a throw here would take down
    // a route rendering somebody else's stored data.
    expect(hostOf('not a url')).toBe('');
    expect(pathOf('not a url')).toBe('');
    expect(pathOf('not a url', 'not a url')).toBe('not a url');
  });
});

describe('sameOrigin', () => {
  it('is scheme, host AND port', () => {
    expect(sameOrigin('https://example.com/a', 'https://example.com/b')).toBe(true);
    expect(sameOrigin('https://example.com', 'http://example.com')).toBe(false);
    expect(sameOrigin('http://localhost:5173', 'http://localhost:3101')).toBe(false);
  });

  it('does not treat a suffix as the same origin', () => {
    // The security boundary for saved-session injection: a prefix match here would hand
    // the session captured for example.com to whoever registers example.com.evil.test.
    expect(sameOrigin('https://example.com', 'https://example.com.evil.test')).toBe(false);
  });

  it('is false when either side is unparseable', () => {
    expect(sameOrigin('https://example.com', 'nonsense')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('assumes https for a bare host and leaves an explicit scheme alone', () => {
    expect(normalizeUrl('  example.com ')).toBe('https://example.com');
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });
});

describe('escapeRegex', () => {
  it('neutralises regex metacharacters', () => {
    const host = 'a.b+c(d)';
    expect(new RegExp(`^${escapeRegex(host)}$`).test(host)).toBe(true);
    expect(new RegExp(`^${escapeRegex(host)}$`).test('axb+c(d)')).toBe(false);
  });
});

describe('hostPrefixRegex', () => {
  it('matches the site itself and anything under it, on either scheme', () => {
    const re = hostPrefixRegex('example.com');
    expect(re.test('https://example.com')).toBe(true);
    expect(re.test('http://example.com/')).toBe(true);
    expect(re.test('https://example.com/pricing')).toBe(true);
  });

  it('matches a stored site that carries a port', () => {
    // The bug this exists to prevent: without `(:\d+)?` every localhost site was invisible
    // to findWebsiteByHost — no budget check, no regression alert, and a duplicate site
    // created on every audit.
    const re = hostPrefixRegex('localhost');
    expect(re.test('http://localhost:4173/')).toBe(true);
    expect(re.test('http://localhost:3000/app')).toBe(true);
  });

  it('never matches a host that merely starts with this one', () => {
    // The trailing (/|$) guard. Removing it is how example.com starts matching
    // example.com.evil.test.
    const re = hostPrefixRegex('example.com');
    expect(re.test('https://example.com.evil.test/')).toBe(false);
    expect(re.test('https://notexample.com/')).toBe(false);
  });
});

describe('normalizedUrlHostRegex', () => {
  it('matches History.normalizedUrl, which is stored without a scheme', () => {
    const re = normalizedUrlHostRegex('example.com');
    expect(re.test('example.com')).toBe(true);
    expect(re.test('example.com/pricing')).toBe(true);
    // The scheme-carrying form is the *other* regex's job; mixing them silently matches
    // nothing, which reads as "this site has no audits".
    expect(re.test('https://example.com/pricing')).toBe(false);
  });

  it('accepts a list of hosts and still guards the boundary', () => {
    const re = normalizedUrlHostRegex(['example.com', 'other.test']);
    expect(re.test('other.test/a')).toBe(true);
    expect(re.test('example.com.evil.test/a')).toBe(false);
  });

  it('escapes the hosts it is given', () => {
    // A host is user input: it arrives from a Website document somebody typed.
    const re = normalizedUrlHostRegex('a.b');
    expect(re.test('axb/page')).toBe(false);
  });
});
