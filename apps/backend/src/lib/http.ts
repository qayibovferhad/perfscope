/**
 * Outbound HTTP with a deadline.
 *
 * Every call this backend makes to someone else's server needs one, and three services
 * had each written the same AbortController + setTimeout + `finally clearTimeout` dance —
 * except `googleAuth.service.ts`, which already used the one-liner the others were
 * reimplementing.
 *
 * The timeout stays a per-caller argument rather than moving into config: 5s for a webhook
 * a user configured, 10s for the CrUX API, 8s for Google's tokeninfo are different
 * judgements about different services, not one knob.
 *
 * Only the mechanism is shared. What a non-2xx means is the caller's business — CrUX reads
 * a 404 as "no field data for this page", a webhook reads any failure as a failed delivery.
 */

/** POST a JSON body, aborting after `timeoutMs`. Rejects on network failure or timeout. */
export function postJson(
  url: string,
  body: unknown,
  { timeoutMs, headers }: { timeoutMs: number; headers?: Record<string, string> },
): Promise<Response> {
  return fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(timeoutMs),
  });
}
