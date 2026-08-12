import { findWebsiteByHost } from './websiteLookup.js';

/**
 * Whether a site is sitting behind a login screen, recorded on the Website document.
 *
 * Domain state, not transport: the socket handler used to own this, which meant the
 * dashboard could only learn about a login wall if the warning happened to be in the
 * one analysis result the user was looking at.
 */

/**
 * Remembers that an audit hit a login screen — or clears the flag when it no longer does.
 *
 * Self-correcting: the flag records *which URL* was walled off, and only a later clean
 * audit of that same URL clears it. Auditing some other route never clears another
 * route's wall.
 */
export async function recordLoginWall(
  userId: string | undefined,
  url: string,
  detected: { finalUrl: string } | undefined,
): Promise<void> {
  if (!userId) return;

  const site = await findWebsiteByHost(userId, url);
  if (!site) return;

  if (detected) {
    site.requiresLogin = { url, loginUrl: detected.finalUrl, detectedAt: new Date() };
    await site.save();
    return;
  }

  if (site.requiresLogin?.url === url) {
    site.requiresLogin = null;
    await site.save();
  }
}

/**
 * A stored session that no longer authenticates is worse than no session: every later
 * audit silently measures a login page. Drop it and flag the site so the dashboard asks
 * for a fresh capture.
 */
export async function dropStaleSession(
  userId: string | undefined,
  url: string,
  loginUrl: string,
): Promise<void> {
  if (!userId) return;

  const site = await findWebsiteByHost(userId, url);
  if (!site) return;

  site.session       = null;
  site.requiresLogin = { url, loginUrl, detectedAt: new Date() };
  await site.save();
}
