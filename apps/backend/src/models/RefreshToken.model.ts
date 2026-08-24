import { Schema, model, type Types } from 'mongoose';

/**
 * One signed-in device.
 *
 * The access token stays a stateless JWT — nothing here is read on an ordinary request, so
 * the per-request cost is unchanged. What this adds is the thing a stateless token cannot
 * do: **end a session**. Before it, a 30-day token that leaked stayed valid for 30 days,
 * changing the password did nothing to it, and "sign out" meant clearing localStorage on
 * the one machine that was already trusted.
 *
 * **Only the hash is stored.** A refresh token is a bearer credential with a month of life
 * in it; a database dump should not be a pile of working logins. Comparison is by SHA-256
 * of the presented value — not bcrypt, because this is a 256-bit random string with no
 * entropy problem to stretch, and the lookup has to be an indexed equality match.
 *
 * `family` is what makes rotation safe. Every refresh mints a successor in the same family;
 * presenting a token that was already used means either a replay or a stolen copy, and the
 * only safe reading is the bad one — so the whole family is revoked and that device has to
 * sign in again.
 */
const refreshTokenSchema = new Schema(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** SHA-256 of the token handed to the client. The token itself is never stored. */
    tokenHash: { type: String, required: true, unique: true },
    /** Shared by every token descended from one sign-in. */
    family:    { type: String, required: true, index: true },
    /** Mongo removes the document itself once this passes — see the TTL index below. */
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    /** Set when this token was rotated: names its successor, for the audit trail. */
    replacedBy: { type: String, default: null },
    /** What signed in — "cli", "extension", or a browser's user-agent string. Shown to a
     *  person deciding which session to end, never used to authorise anything. */
    client:    { type: String, default: '' },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

/**
 * Expired sessions delete themselves.
 *
 * `expireAfterSeconds: 0` means "remove when `expiresAt` is in the past" — the document
 * carries its own deadline, which is right here because a CLI session and a browser one may
 * legitimately have different lifetimes.
 */
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface IRefreshToken {
  _id:        Types.ObjectId;
  userId:     Types.ObjectId;
  tokenHash:  string;
  family:     string;
  expiresAt:  Date;
  revokedAt:  Date | null;
  replacedBy: string | null;
  client:     string;
  lastUsedAt: Date | null;
  createdAt:  Date;
  updatedAt:  Date;
}

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
