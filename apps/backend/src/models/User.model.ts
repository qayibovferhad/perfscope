import { Schema, model } from 'mongoose';

/**
 * Opt-in weekly summary. Unlike alerts — which demand a reaction — this is a digest
 * meant to be read, so it is scheduled rather than triggered.
 */
const digestSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    /** 0 = Sunday … 6 = Saturday. */
    day:     { type: Number, default: 1, min: 0, max: 6 },
    /** Server-local HH:MM, matched by the cron the same way nightly audits are. */
    time:    { type: String, default: '09:00' },
    lastSentAt: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    picture:  { type: String, default: '' },
    provider: { type: String, enum: ['email', 'google'], default: 'email' },
    /** Google's stable account id, set the first time this address signs in with Google.
     *  Accounts are matched on email — this records the link rather than establishing it. */
    googleId: { type: String, default: null, index: true },
    digest:   { type: digestSchema, default: () => ({ enabled: false, day: 1, time: '09:00', lastSentAt: null }) },
  },
  { timestamps: true },
);

export interface IUserDigest {
  enabled:    boolean;
  day:        number;
  time:       string;
  lastSentAt: Date | null;
}

export const User = model('User', userSchema);
