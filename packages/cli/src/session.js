import axios from 'axios';
import { loadCredentials, saveCredentials } from './auth.js';

/**
 * Keeping the CLI signed in now that access tokens are short.
 *
 * `perfscope login` used to save a token good for thirty days and hand it to every command
 * forever. Access tokens live thirty minutes now, so a saved one is almost always stale by
 * the time the next command runs — which would have made the CLI ask for a fresh login
 * every morning. What it saves instead is a *session*: a short access token and the refresh
 * token that renews it.
 *
 * The expiry check is local. A JWT carries its own `exp`, so there is no reason to spend a
 * round trip discovering that a token is still good — the network call happens only when it
 * genuinely has to.
 */

/** Renew this far before the deadline, so a command that takes a while does not have its
 *  token expire halfway through an audit it already started. */
const EARLY_RENEWAL_MS = 2 * 60 * 1000;

/** `exp` from a JWT, in ms, or null when it has none / cannot be read. */
function expiryOf(token) {
  try {
    const [, payload] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString());
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

function stillValid(token) {
  const exp = expiryOf(token);
  // A token with no readable expiry is left alone: it may be an older long-lived one, and
  // refusing to use it would break a setup that currently works.
  return exp === null || exp - EARLY_RENEWAL_MS > Date.now();
}

async function refresh(apiUrl, refreshToken) {
  const res = await axios.post(`${apiUrl.replace(/\/$/, '')}/api/auth/refresh`, { refreshToken }, {
    timeout: 10_000,
  });
  const body = res.data?.data ?? res.data;
  if (!body?.token || !body?.refreshToken) throw new Error('Unexpected refresh response');
  return body;
}

/**
 * The access token to send, renewed if it has to be.
 *
 * Order of precedence, unchanged at the front: an explicit `--key`, then
 * `PERFSCOPE_API_KEY`, then the saved login. `PERFSCOPE_REFRESH_TOKEN` is the new one and
 * exists for CI: a pipeline cannot run `perfscope login`, and a thirty-minute token pasted
 * into a secret would be stale before the first build. Give it a refresh token and the CLI
 * mints its own access token per run.
 *
 * Returns null when there is nothing to use — the caller prints the "not logged in" message,
 * because only it knows which command was being attempted.
 */
export async function resolveAccessToken(opts = {}) {
  const explicit = opts.key || process.env.PERFSCOPE_API_KEY || '';
  if (explicit) return explicit;

  const envRefresh = process.env.PERFSCOPE_REFRESH_TOKEN;
  if (envRefresh) {
    const tokens = await refresh(opts.apiUrl ?? 'http://localhost:3101', envRefresh);
    return tokens.token;
  }

  const creds = loadCredentials();
  if (!creds?.token) return null;
  if (stillValid(creds.token)) return creds.token;

  if (!creds.refreshToken) return creds.token;   // pre-refresh login; let the server judge it

  const tokens = await refresh(opts.apiUrl ?? 'http://localhost:3101', creds.refreshToken);
  // Saved immediately: refresh tokens rotate, so the one just spent is already dead and
  // losing the successor would strand the login.
  saveCredentials(tokens, creds.email);
  return tokens.token;
}

/** The stored refresh token, for `logout` — which ends the session on the server rather
 *  than only deleting the file. */
export function storedRefreshToken() {
  return loadCredentials()?.refreshToken ?? null;
}
