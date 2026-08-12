import { config } from '../config/index.js';

/** Tells us who the token was issued to, and for whom. */
const TOKENINFO = 'https://oauth2.googleapis.com/tokeninfo';
/** Display name and avatar. The token endpoint above does not carry them. */
const USERINFO  = 'https://www.googleapis.com/oauth2/v3/userinfo';

/** Google is a hard dependency of this request, but never a reason to hang on to a socket. */
const TIMEOUT_MS = 8_000;

export interface GoogleIdentity {
  /** Google's stable account id. */
  googleId: string;
  email:    string;
  name:     string;
  picture:  string;
}

/** A sign-in that must be refused, with a reason worth showing the user. */
export class GoogleAuthError extends Error {}

async function getJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new GoogleAuthError('Google rejected the sign-in token.');
  return await res.json() as Record<string, unknown>;
}

/**
 * Turn a Google access token into an identity we are willing to sign in.
 *
 * The token is checked with Google rather than the profile being taken from the client:
 * the browser sends whatever it likes, so trusting a posted email would let anyone sign in
 * as anyone. Two things are verified — that Google issued the token **to this app**
 * (otherwise a token obtained by any other site could be replayed here), and that Google
 * considers the address verified.
 */
export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleIdentity> {
  const info = await getJson(`${TOKENINFO}?access_token=${encodeURIComponent(accessToken)}`);

  const audience = typeof info['aud'] === 'string' ? info['aud'] : '';
  if (config.googleClientId && audience !== config.googleClientId) {
    throw new GoogleAuthError('That Google token was issued for a different application.');
  }

  const email = typeof info['email'] === 'string' ? info['email'].toLowerCase() : '';
  if (!email) {
    throw new GoogleAuthError('That Google account did not share an email address.');
  }

  // The field arrives as the string "true" here and as a boolean from the profile endpoint.
  const verified = info['email_verified'];
  if (verified !== true && verified !== 'true') {
    throw new GoogleAuthError('That Google address is not verified.');
  }

  const profile = await getJson(USERINFO, { headers: { Authorization: `Bearer ${accessToken}` } });

  return {
    googleId: String(info['sub'] ?? profile['sub'] ?? ''),
    email,
    // A name is required on the user document, and an address is a better label than "".
    name:    typeof profile['name'] === 'string' && profile['name'] ? profile['name'] : email,
    picture: typeof profile['picture'] === 'string' ? profile['picture'] : '',
  };
}
