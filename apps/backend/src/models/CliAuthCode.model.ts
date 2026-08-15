import { Schema, model, type Types } from 'mongoose';

/**
 * A `perfscope login` handshake in progress.
 *
 * The CLI registers a code, opens the browser at `/cli-auth?code=…`, and polls until the
 * signed-in page posts its verified token against that code. That is three requests which
 * must all reach the same state — so it cannot live in a per-process Map behind more than
 * one backend instance, and it should not die because the server restarted mid-login.
 *
 * The token is stored briefly and deleted the moment the CLI collects it; the TTL index is
 * the backstop for a login the user abandoned.
 */
const cliAuthCodeSchema = new Schema(
  {
    code:  { type: String, required: true, unique: true },
    /** Set by the browser once the user is signed in. Absent while still pending. */
    token: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/** Long enough to finish a browser login, short enough that an abandoned code dies. */
export const CODE_TTL_SECONDS = 10 * 60;

// Mongo's TTL monitor runs about once a minute, so an expired code can outlive its deadline
// by up to that long. Every read filters on createdAt as well rather than trusting it.
cliAuthCodeSchema.index({ createdAt: 1 }, { expireAfterSeconds: CODE_TTL_SECONDS });

export interface ICliAuthCode {
  _id:       Types.ObjectId;
  code:      string;
  token:     string | null;
  createdAt: Date;
}

export const CliAuthCode = model<ICliAuthCode>('CliAuthCode', cliAuthCodeSchema);
