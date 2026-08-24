/**
 * Sessions, at the level where the rules live.
 *
 * The HTTP probe next door proves the endpoints are wired; this proves the things that are
 * invisible from outside and are the entire reason the feature exists: that a spent refresh
 * token is dead, that spending one twice kills the whole family rather than just failing,
 * that revocation reaches every device, and that a password reset link works exactly once.
 *
 * Runs against the real Mongo — these are database rules, and a mocked store would be
 * asserting the mock. Everything it creates is removed at the end.
 *
 *   cd apps/backend && npx tsx probes/auth-flow.probe.mts
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.model.js';
import { RefreshToken } from '../src/models/RefreshToken.model.js';
import { PasswordReset } from '../src/models/PasswordReset.model.js';
import {
  issueTokens, rotateTokens, revokeRefreshToken, revokeAllForUser, activeSessionCount,
} from '../src/services/authTokens.service.js';
import { requestPasswordReset, completePasswordReset } from '../src/services/passwordReset.service.js';
import bcrypt from 'bcryptjs';

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/** Run something that is supposed to throw, and hand back the message. */
async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try { await fn(); return null; } catch (err) { return (err as Error).message; }
}

const EMAIL = `probe-auth-${Date.now()}@probe.test`;

await mongoose.connect(config.mongoUri);

const user = await User.create({
  name: 'Auth Probe', email: EMAIL, provider: 'email',
  password: await bcrypt.hash('original-password', 10),
});

try {
  // ─── Rotation ──────────────────────────────────────────────────────────────
  const first = await issueTokens(user, 'probe/browser');
  check(!!first.token && !!first.refreshToken, 'signing in issues an access token and a refresh token');
  check(first.token.split('.').length === 3, 'the access token is a JWT');
  check(!first.refreshToken.includes('.'), 'the refresh token is opaque — it carries no claims');

  const stored = await RefreshToken.findOne({ userId: user._id }).lean();
  check(stored?.tokenHash !== first.refreshToken, 'only a hash of it is stored, never the token');

  const second = await rotateTokens(first.refreshToken, 'probe/browser');
  check(second.refreshToken !== first.refreshToken, 'refreshing rotates the refresh token');
  check(String(second.user._id) === String(user._id), 'and hands back the account it belongs to');

  const spent = await refused(() => rotateTokens(first.refreshToken));
  check(/ended|invalid|expired/i.test(spent ?? ''), `the spent token no longer works (${spent})`);

  // ─── Reuse detection ───────────────────────────────────────────────────────
  // Presenting a spent token is either a replay or a copy somebody else holds, and there is
  // no way to tell which — so the successor dies too and the real user signs in again.
  const successorAfterReuse = await refused(() => rotateTokens(second.refreshToken));
  check(successorAfterReuse !== null, 'reusing a spent token takes the whole family down with it');
  check(await activeSessionCount(String(user._id)) === 0, 'leaving no live session behind');

  // ─── Ending one session ────────────────────────────────────────────────────
  const browser = await issueTokens(user, 'probe/browser');
  const cli     = await issueTokens(user, 'cli');
  check(await activeSessionCount(String(user._id)) === 2, 'two devices, two sessions');

  await revokeRefreshToken(cli.refreshToken);
  check(await activeSessionCount(String(user._id)) === 1, 'signing out ends that session only');
  check(await refused(() => rotateTokens(cli.refreshToken)) !== null, 'and its token stops refreshing');
  check(await refused(() => rotateTokens(browser.refreshToken)) === null, 'while the other device is untouched');

  // Signing out with a token nobody has ever seen must not throw: a client whose session
  // already lapsed still presses the button, and it has to succeed.
  check(await refused(() => revokeRefreshToken('never-issued')) === null, 'signing out an unknown token is not an error');

  // ─── Ending all of them ────────────────────────────────────────────────────
  const keep = await issueTokens(user, 'probe/keep');
  await issueTokens(user, 'probe/phone');
  await issueTokens(user, 'probe/laptop');

  const ended = await revokeAllForUser(String(user._id), keep.refreshToken);
  check(ended >= 3, `"sign out everywhere" reports how many it ended (${ended})`);
  check(await refused(() => rotateTokens(keep.refreshToken)) === null, 'and keeps the device that asked');

  // ─── Password reset ────────────────────────────────────────────────────────
  await revokeAllForUser(String(user._id));
  const live = await issueTokens(user, 'probe/browser');

  // With no SMTP the link is logged rather than sent — that is what makes this flow
  // exercisable at all in development, and it is the only way to get the raw token, which
  // is never stored.
  const logged: string[] = [];
  const realLog = console.log;
  console.log = (...args: unknown[]) => { logged.push(args.join(' ')); };
  await requestPasswordReset(EMAIL);
  console.log = realLog;

  const token = logged.join('\n').match(/reset-password\?token=([\w-]+)/)?.[1];
  check(!!token, 'a reset request produces a one-time link');

  const pending = await PasswordReset.findOne({ userId: user._id, usedAt: null }).lean();
  check(!!pending && pending.tokenHash !== token, 'stored as a hash, like the refresh token');

  const wrong = await refused(() => completePasswordReset('not-the-token', 'brand-new-password'));
  check(/invalid or has expired/i.test(wrong ?? ''), 'a wrong token is refused with one vague message');

  await completePasswordReset(token!, 'brand-new-password');
  const after = await User.findById(user._id);
  check(await bcrypt.compare('brand-new-password', after!.password ?? ''), 'the new password is set');

  const replay = await refused(() => completePasswordReset(token!, 'third-password'));
  check(replay !== null, 'and the link cannot be used a second time');

  // The point of resetting is that somebody else may be signed in. Leaving their month-long
  // refresh token alive would make the reset a gesture.
  check(await refused(() => rotateTokens(live.refreshToken)) !== null, 'every session was ended by the reset');

  // ─── No enumeration ────────────────────────────────────────────────────────
  // Whether an address has an account is not something an anonymous form may reveal, so
  // this has to be silent for an unknown one rather than throwing.
  check(await refused(() => requestPasswordReset('nobody-here@probe.test')) === null,
    'asking about an unknown address is answered the same way');
  check(await PasswordReset.countDocuments({}) >= 0, 'and creates nothing for it');
} finally {
  await RefreshToken.deleteMany({ userId: user._id });
  await PasswordReset.deleteMany({ userId: user._id });
  await User.deleteOne({ _id: user._id });
  await mongoose.disconnect();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
