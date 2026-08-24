/**
 * Keeping a user-supplied URL from pointing the server at its own network.
 *
 * Everything this product does with a URL is a server-side fetch: Lighthouse loads the
 * page, the sitemap reader downloads XML, an alert POSTs to a webhook. On a laptop that is
 * exactly right — auditing `http://localhost:5173` is a first-class use of this tool and
 * always has been. On a public host it is a request forgery primitive: `http://10.0.0.7/`,
 * a cloud metadata service at `169.254.169.254`, an admin panel that only listens on the
 * private interface. The audit even renders the response back to the caller, screenshots
 * included, so the read is not blind.
 *
 * So the rule is decided by where the server is, not by what the caller typed:
 * `config.blockPrivateTargets` is on in production and off in development, and
 * `ALLOW_PRIVATE_TARGETS=true` turns it back off for an install that deliberately audits an
 * intranet. Nothing here changes behaviour on a developer's machine.
 *
 * **Resolution, not spelling.** Checking the hostname text would stop `http://127.0.0.1`
 * and nothing else: `localtest.me`, a shortened URL and any attacker-controlled domain all
 * resolve wherever their owner points them. The names are resolved and every address they
 * answer with is checked.
 *
 * **What this does not do.** The connection is made later, by Lighthouse or by `fetch`,
 * from a second resolution — so a domain whose DNS flips between the check and the fetch
 * (rebinding) is not covered by this alone. Closing that means pinning the resolved address
 * into the request, which neither Chrome nor `fetch` lets us do here. This raises the cost
 * from "type an IP" to "run a rebinding server", and the rest is a proxy's job.
 */
import { lookup } from 'node:dns/promises';
import { config } from '../config/index.js';
import { AppError } from './errors.js';
import { hostOf } from './url.js';

/**
 * Addresses that name this machine, this network, or a range that has no business being a
 * page to audit. Written out per range rather than as one regex because each is here for
 * its own reason and a reader has to be able to tell which one caught a URL.
 */
export function isPrivateAddress(address: string): boolean {
  const ip = address.trim().toLowerCase();

  // IPv6 shorthand for an IPv4 address — the range that matters is the v4 one inside it.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped?.[1]) return isPrivateAddress(mapped[1]);

  if (ip.includes(':')) {
    if (ip === '::' || ip === '::1') return true;              // unspecified, loopback
    if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true;            // fc00::/7  unique local
    if (/^fe[89ab][0-9a-f]:/.test(ip)) return true;            // fe80::/10 link-local
    return false;
  }

  const parts = ip.split('.');
  if (parts.length !== 4) return true;                          // not an address we can judge
  const [a, b] = parts.map(Number) as [number, number, number, number];
  if (parts.some(p => !/^\d{1,3}$/.test(p)) || [a, b].some(n => Number.isNaN(n))) return true;

  if (a === 0)   return true;                                   // "this network"
  if (a === 10)  return true;                                   // private
  if (a === 127) return true;                                   // loopback
  if (a === 169 && b === 254) return true;                      // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;             // private
  if (a === 192 && b === 168) return true;                      // private
  if (a === 100 && b >= 64 && b <= 127) return true;            // carrier-grade NAT
  if (a === 192 && b === 0)  return true;                       // IETF protocol assignments
  if (a === 198 && b >= 18 && b <= 19) return true;             // benchmarking
  if (a >= 224) return true;                                    // multicast and reserved, incl. 255.*

  return false;
}

/** Every address a hostname answers with; empty when it resolves to nothing. */
async function addressesOf(hostname: string): Promise<string[]> {
  try {
    const found = await lookup(hostname, { all: true, verbatim: true });
    return found.map(f => f.address);
  } catch {
    return [];
  }
}

/**
 * Whether a URL points into a private network — resolving its host to find out.
 *
 * A name that resolves to nothing counts as private: the caller is about to hand it to a
 * fetch that will fail anyway, and treating "we could not tell" as public is the wrong way
 * round for a guard.
 */
export async function resolvesToPrivateNetwork(url: string): Promise<boolean> {
  const host = hostOf(url);
  if (!host) return true;

  // A bracketed IPv6 literal arrives from `hostname` without its brackets already.
  if (isPrivateAddress(host) && !/[a-z]/i.test(host.replace(/^::ffff:/, ''))) return true;

  const addresses = await addressesOf(host);
  if (addresses.length === 0) return true;
  return addresses.some(isPrivateAddress);
}

/**
 * Throw unless this URL may be fetched by the server.
 *
 * `what` names the thing being fetched ("audit target", "webhook") so the message says
 * which of a request's several URLs was refused.
 */
export async function assertPublicTarget(url: string, what = 'target'): Promise<void> {
  if (!config.blockPrivateTargets) return;
  if (await resolvesToPrivateNetwork(url)) {
    throw new AppError(400, `That ${what} resolves to a private or local address, which this server will not fetch.`);
  }
}

/** The same check as a boolean, for callers that skip rather than fail. */
export async function isFetchableTarget(url: string): Promise<boolean> {
  if (!config.blockPrivateTargets) return true;
  return !(await resolvesToPrivateNetwork(url));
}
