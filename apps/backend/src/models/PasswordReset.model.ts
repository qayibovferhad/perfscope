import { Schema, model, type Types } from 'mongoose';

/**
 * A pending "I forgot my password".
 *
 * Hashed like a refresh token and for the same reason — it is a bearer credential that can
 * take over an account, so the database must not hold a working copy of it.
 *
 * Short-lived and single-use: the link goes to an inbox, and an inbox is a place where a
 * link can sit for years. `usedAt` is what stops the same mail being replayed after the
 * password has already been changed.
 */
const passwordResetSchema = new Schema(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt:    { type: Date, default: null },
  },
  { timestamps: true },
);

/** The request deletes itself once it expires — nothing needs the history of who asked. */
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface IPasswordReset {
  _id:       Types.ObjectId;
  userId:    Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt:    Date | null;
  createdAt: Date;
}

export const PasswordReset = model<IPasswordReset>('PasswordReset', passwordResetSchema);
