import { Website } from '../models/Website.model.js';
import { CompetitorSession } from '../models/CompetitorSession.model.js';
import { sameOrigin } from '../lib/url.js';
import { siteHostFilter } from './websiteLookup.js';
import type { AuthSessionData } from './authAuditSession.js';

/**
 * Where captured login sessions are kept and found again.
 *
 * Sessions live in two collections — a site the user owns (`Website.session`) and a
 * rival they only audit (`CompetitorSession.session`) — so both halves of "do we have a
 * session for this URL?" belong together rather than inline in the socket handler.
 */

// Narrows a lookup to documents that could plausibly be the same origin. The functions
// below used to load *every* website and competitor session for the user — unprojected,
// so every stored session blob — and filter in JS; siteHostFilter is the same question
// asked of Mongo. `sameOrigin` still makes the actual decision on the survivors.
// One definition, shared with websiteLookup: this filter is the access boundary for
// injecting saved credentials, and it briefly existed as two copies.

/**
 * A saved session for this exact origin, or null.
 *
 * Origin equality is the security boundary, not a prefix match: `example.com.evil.test`
 * must never receive the session captured for `example.com`. Returns null rather than an
 * empty session — Mongo drops an empty localStorage map and a cookies-only capture is
 * perfectly normal, so "has a session document" and "has anything to inject" differ.
 */
export async function findSessionFor(
  userId: string,
  url: string,
): Promise<AuthSessionData | null> {
  const onHost = siteHostFilter(userId, url);
  if (!onHost) return null;

  const [websites, competitorSessions] = await Promise.all([
    Website.find(onHost).select('url session').lean(),
    CompetitorSession.find(onHost).select('url session').lean(),
  ]);

  const sources = [
    ...websites.map(w => ({ url: w.url, session: w.session })),
    ...competitorSessions.map(c => ({ url: c.url, session: c.session })),
  ];

  const match = sources.find(s => s.session && sameOrigin(url, s.url));
  if (!match?.session) return null;

  const cookies      = match.session.cookies ?? [];
  const localStorage = (match.session.localStorage ?? {}) as Record<string, string>;
  if (cookies.length === 0 && Object.keys(localStorage).length === 0) return null;

  return { cookies, localStorage } as AuthSessionData;
}

/**
 * Stores a freshly captured session so later audits of the same origin can reuse it.
 *
 * Capturing a session is the answer to the login-wall warning, so `requiresLogin` is
 * cleared here — the same rule PATCH /websites/:id/session follows. A later audit that
 * still lands on the login screen sets it again; that is the expiry signal.
 */
export async function persistCapturedSession(
  userId: string,
  url: string,
  session: AuthSessionData,
  context: 'competitor' | 'own',
): Promise<void> {
  const payload  = { ...session, capturedAt: new Date() };
  const { origin, hostname } = new URL(url);

  if (context === 'competitor') {
    await CompetitorSession.findOneAndUpdate(
      { userId, url: origin },
      { $set: { session: payload, name: hostname } },
      { upsert: true, new: true },
    );
    return;
  }

  // Match an existing site by origin first: upserting on `url` alone would create a
  // second document for a site already tracked under a different path.
  const onHost = siteHostFilter(userId, url);
  const sites  = onHost ? await Website.find(onHost).select('url').lean() : [];
  const match  = sites.find(w => sameOrigin(url, w.url as string));

  if (match) {
    await Website.findByIdAndUpdate(match._id, { session: payload, requiresLogin: null });
    return;
  }

  await Website.findOneAndUpdate(
    { userId, url: origin },
    { $set: { session: payload, name: hostname, requiresLogin: null } },
    { upsert: true, new: true },
  );
}
