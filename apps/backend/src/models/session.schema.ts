import { Schema } from 'mongoose';

/**
 * A captured browser session — the cookies and localStorage the auth-audit flow harvests
 * from a real logged-in browser so Lighthouse can measure a page behind a login wall.
 *
 * Both Website and CompetitorSession store one, and they must stay the same shape: the
 * injection path (`services/sessionStore.ts`) reads either without caring which it came
 * from. This file is the one definition.
 *
 * These are live credentials. Nothing here may cross the wire — see `redactSession`.
 */

const cookieSchema = new Schema({
  name:     { type: String },
  value:    { type: String },
  domain:   { type: String },
  path:     { type: String },
  expires:  { type: Number },
  httpOnly: { type: Boolean },
  secure:   { type: Boolean },
  sameSite: { type: String },
}, { _id: false });

export const sessionSchema = new Schema({
  cookies:      { type: [cookieSchema], default: [] },
  localStorage: { type: Schema.Types.Mixed, default: {} },
  capturedAt:   { type: Date, default: Date.now },
}, { _id: false });

export interface ISessionCookie {
  name?: string; value?: string; domain?: string; path?: string;
  expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string;
}

export interface ISessionData {
  cookies: ISessionCookie[];
  localStorage: Record<string, string>;
  capturedAt: Date;
}

/**
 * Strips a serialised document down to the *fact* that a session was captured and when.
 *
 * The client only ever asks whether a session exists and whether it still works — see
 * `sessionState()` in the dashboard, which reads `session` for truthiness and
 * `requiresLogin` for the rest. Sending the cookie values along with that answer hands
 * every logged-in browser tab a working credential for the audited site, and for a
 * competitor's site too.
 *
 * Wired as a `toJSON` transform rather than a `.select()` on each route because four of
 * the seven endpoints that return one of these documents are `findOneAndUpdate` returns,
 * which a per-query projection is easy to forget on — and because `.lean()` bypasses
 * `toJSON` entirely, which is exactly what the injection path already uses to read the
 * real cookies.
 */
export function redactSession(ret: Record<string, unknown>): void {
  const session = ret['session'] as { capturedAt?: Date } | null | undefined;
  ret['session'] = session ? { capturedAt: session.capturedAt } : null;
}
