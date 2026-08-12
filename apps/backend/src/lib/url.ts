/** URL helpers shared across routes, services, and the socket handler. */

export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Hostname of a URL; empty string when unparseable. */
export function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

/**
 * Strict scheme+host+port equality. The security boundary for saved-session
 * injection: a prefix match would let `https://example.com.evil.test` receive
 * the session saved for `https://example.com`.
 */
export function sameOrigin(a: string, b: string): boolean {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}

export function normalizeUrl(url: string): string {
  const t = url.trim();
  return t.startsWith('http') ? t : `https://${t}`;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches URLs that live under the given host (used to group audits per site). */
export function hostPrefixRegex(host: string): RegExp {
  return new RegExp(`^https?://${escapeRegex(host)}(/|$)`);
}

/**
 * Like hostPrefixRegex, but for `History.normalizedUrl`, which is stored WITHOUT a scheme
 * (`host/path`). The two stored forms are the trap: `Website.url` keeps its scheme,
 * `normalizedUrl` does not, so the two regexes are deliberately different.
 */
export function normalizedUrlHostRegex(hosts: string | string[]): RegExp {
  const list = Array.isArray(hosts) ? hosts : [hosts];
  return new RegExp(`^(${list.map(escapeRegex).join('|')})(/|$)`);
}
