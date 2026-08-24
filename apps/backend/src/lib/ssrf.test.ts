import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isPrivateAddress } from './ssrf.js';

describe('isPrivateAddress — IPv4', () => {
  it('names the ranges that point back at the server or its network', () => {
    for (const ip of [
      '127.0.0.1', '127.1.1.1',      // loopback
      '0.0.0.0',                      // "this network"
      '10.0.0.7', '10.255.255.255',   // private
      '172.16.0.1', '172.31.255.1',   // private
      '192.168.1.1',                  // private
      '169.254.169.254',              // cloud metadata — the one everybody goes for
      '100.64.0.1',                   // carrier-grade NAT
      '192.0.0.1',                    // IETF protocol assignments
      '198.18.0.1',                   // benchmarking
      '224.0.0.1', '255.255.255.255', // multicast and broadcast
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('leaves ordinary public addresses alone', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '11.0.0.1', '100.63.255.255']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('treats anything it cannot read as private', () => {
    // A guard that answers "looks fine" to input it did not understand is the wrong way
    // round.
    for (const junk of ['', 'localhost', '10.0.0', '999.1.1.1', 'not an address']) {
      expect(isPrivateAddress(junk), junk).toBe(true);
    }
  });
});

describe('isPrivateAddress — IPv6', () => {
  it('covers loopback, unspecified, unique-local and link-local', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'FE80::1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('reads a v4-mapped address as the v4 address it is', () => {
    // `::ffff:169.254.169.254` is the metadata service wearing a different hat.
    expect(isPrivateAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('leaves public v6 alone', () => {
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
  });
});

/**
 * The resolving half needs the config flag on, which is off in this environment by design
 * — so these re-import the module with production settings and a stubbed resolver.
 */
describe('resolvesToPrivateNetwork', () => {
  const load = async (addresses: string[]) => {
    vi.resetModules();
    vi.doMock('node:dns/promises', () => ({
      lookup: vi.fn(async () => addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 }))),
    }));
    return import('./ssrf.js');
  };

  beforeEach(() => { vi.stubEnv('NODE_ENV', 'production'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock('node:dns/promises'); vi.resetModules(); });

  it('judges a hostname by what it resolves to, not by how it is spelled', async () => {
    // Checking the text would stop `http://127.0.0.1` and nothing else: any domain its
    // owner controls can be pointed at the metadata service.
    const { resolvesToPrivateNetwork } = await load(['169.254.169.254']);
    expect(await resolvesToPrivateNetwork('https://totally-normal.example/')).toBe(true);
  });

  it('lets a public host through', async () => {
    const { resolvesToPrivateNetwork } = await load(['93.184.216.34']);
    expect(await resolvesToPrivateNetwork('https://example.com/page')).toBe(false);
  });

  it('blocks when any one of several answers is private', async () => {
    // A name with both records is the ordinary way past a check that looks at the first.
    const { resolvesToPrivateNetwork } = await load(['93.184.216.34', '10.0.0.7']);
    expect(await resolvesToPrivateNetwork('https://mixed.example/')).toBe(true);
  });

  it('blocks a name that resolves to nothing', async () => {
    const { resolvesToPrivateNetwork } = await load([]);
    expect(await resolvesToPrivateNetwork('https://does-not-exist.invalid/')).toBe(true);
  });

  it('blocks an unusable URL without asking DNS anything', async () => {
    const { resolvesToPrivateNetwork } = await load(['93.184.216.34']);
    expect(await resolvesToPrivateNetwork('not a url')).toBe(true);
  });
});

describe('the switch', () => {
  const loadWith = async (env: Record<string, string>) => {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    vi.doMock('node:dns/promises', () => ({ lookup: vi.fn(async () => [{ address: '127.0.0.1', family: 4 }]) }));
    return import('./ssrf.js');
  };

  afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock('node:dns/promises'); vi.resetModules(); });

  it('is off in development — auditing localhost is the ordinary case here', async () => {
    const { isFetchableTarget, assertPublicTarget } = await loadWith({ NODE_ENV: 'development' });
    expect(await isFetchableTarget('http://localhost:5173/')).toBe(true);
    await expect(assertPublicTarget('http://localhost:5173/')).resolves.toBeUndefined();
  });

  it('is on in production', async () => {
    const { isFetchableTarget, assertPublicTarget } = await loadWith({ NODE_ENV: 'production' });
    expect(await isFetchableTarget('http://localhost:5173/')).toBe(false);
    await expect(assertPublicTarget('http://localhost:5173/', 'audit target'))
      .rejects.toThrow(/audit target resolves to a private or local address/);
  });

  it('can be turned back off for an install that audits an intranet on purpose', async () => {
    const { isFetchableTarget } = await loadWith({ NODE_ENV: 'production', ALLOW_PRIVATE_TARGETS: 'true' });
    expect(await isFetchableTarget('http://10.0.0.7/')).toBe(true);
  });
});
