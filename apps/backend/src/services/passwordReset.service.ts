/**
 * "I forgot my password", end to end.
 *
 * Two rules shape this and both are about what the endpoint reveals:
 *
 * 1. **It never says whether the address exists.** The request answers the same way for a
 *    registered address, an unknown one and a Google-only account. Anything else turns the
 *    form into a way to enumerate users — and this is the one form on the site that anybody
 *    can post to without an account.
 * 2. **A reset ends every session.** Someone resetting a password is either locked out or
 *    has reason to think somebody else is in; leaving the intruder's month-long refresh
 *    token alive would make the reset theatre.
 *
 * With no SMTP configured — the ordinary development state, see the env notes — the mail
 * cannot be sent. Rather than fail silently, the link is logged, so the flow can actually
 * be exercised locally. That happens **only** outside production: a link on stdout is a
 * credential in the log file.
 */
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { PasswordReset } from '../models/PasswordReset.model.js';
import { User } from '../models/User.model.js';
import { Mailer } from './mailer.service.js';
import { revokeAllForUser } from './authTokens.service.js';
import { AppError } from '../lib/errors.js';

/** Long enough to fetch the mail and follow it, short enough that an old message in an
 *  inbox is not a standing key to the account. */
const RESET_TTL_MS = 60 * 60 * 1000;

/** Same work factor the rest of auth uses; one constant per file would be two. */
const BCRYPT_ROUNDS = 10;

const hashOf = (raw: string) => createHash('sha256').update(raw).digest('hex');

function resetUrl(token: string): string {
  return `${config.clientUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
}

/**
 * Start a reset for whoever owns this address, if anyone does.
 *
 * Returns nothing in every case — the caller must not be able to tell the outcomes apart,
 * and giving it a boolean is how that leak gets introduced later by someone being helpful.
 */
export async function requestPasswordReset(email: string, ): Promise<void> {
  const address = email.trim().toLowerCase();
  const user = await User.findOne({ email: address });
  if (!user) return;

  // An account that has only ever signed in with Google has no password to reset. Setting
  // one from an email link would be a second way into that account, created by anyone who
  // knows the address — the "set a password" flow lives behind an existing sign-in for
  // exactly that reason.
  if (!user.password && user.provider === 'google') {
    await Mailer.send(
      address,
      'PerfScope — password reset requested',
      'Someone asked to reset the password for this address, but this account signs in with Google.\n\n' +
      'Use "Continue with Google" on the sign-in page. If that was not you, nothing has changed.',
    );
    return;
  }

  // One live request per account: asking twice sends a second mail and retires the first
  // link, which is what someone clicking "resend" expects.
  await PasswordReset.updateMany({ userId: user._id, usedAt: null }, { usedAt: new Date() });

  const token = randomBytes(32).toString('base64url');
  await PasswordReset.create({
    userId:    user._id,
    tokenHash: hashOf(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });

  const link = resetUrl(token);
  const text = [
    `Hi ${user.name},`,
    '',
    'Use this link to set a new PerfScope password. It works once and expires in an hour:',
    link,
    '',
    'If you did not ask for this, ignore this email — your password has not changed.',
  ].join('\n');

  if (Mailer.isAvailable()) {
    await Mailer.send(address, 'Reset your PerfScope password', text);
  } else if (config.nodeEnv !== 'production') {
    console.log(`[PasswordReset] No SMTP configured — reset link for ${address}:\n  ${link}`);
  } else {
    // Production with no mailer: the user is waiting for a mail that cannot arrive, and
    // that is an operator problem worth a loud line rather than a silent success.
    console.error('[PasswordReset] SMTP is not configured — a reset was requested and could not be delivered');
  }
}

/**
 * Spend a reset token: set the new password and end every session.
 *
 * The token is consumed before the password is written, so a request that races itself
 * cannot apply twice.
 */
export async function completePasswordReset(token: string, newPassword: string): Promise<void> {
  const record = await PasswordReset.findOne({ tokenHash: hashOf(token) });

  // One message for expired, used, and never-existed. They are all "this link is no longer
  // good", and telling them apart tells a stranger which guesses were close.
  const invalid = new AppError(400, 'That reset link is invalid or has expired. Request a new one.');
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) throw invalid;

  const user = await User.findById(record.userId);
  if (!user) throw invalid;

  record.usedAt = new Date();
  await record.save();

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();

  await revokeAllForUser(String(user._id));
}
