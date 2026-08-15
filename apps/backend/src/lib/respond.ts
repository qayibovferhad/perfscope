import type { Response } from 'express';

/**
 * The success half of the API's response contract.
 *
 * Failures have looked the same everywhere since `errorMiddleware` landed —
 * `{ success: false, error }` — but successes did not: half the routes answered
 * `{ success: true, data }` and half answered a bare array, a bare object, or
 * `{ ok: true }`. A client therefore had to know, per endpoint, which of three shapes
 * to expect on the way in and a fourth on the way out, and the dashboard's `fetchJson`
 * helper only worked on the enveloped half.
 *
 * One shape now: `{ success: true, data }`, with `data` null when there is nothing to
 * return. Nothing outside this repo consumed the old shapes — the CLI is unpublished and
 * the extension is private — so this was a free change to make and only gets more
 * expensive the longer it waits.
 */
export function ok<T>(res: Response, data: T = null as T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}
