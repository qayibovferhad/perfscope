/**
 * The API's response contract, from the CLI's side.
 *
 * Every endpoint answers `{ success: true, data }` or `{ success: false, error }`. The CLI
 * used to read some responses as bare payloads and others through the envelope, which was
 * fine only for as long as nobody changed which was which.
 */

/**
 * The payload of an axios response, or a thrown Error carrying the server's own message.
 *
 * A body without the envelope is passed through untouched rather than becoming `undefined`:
 * the CLI ships separately from the backend and may well be pointed at an older one.
 */
export function unwrap(res) {
  const body = res?.data;
  if (body && typeof body === 'object' && 'success' in body) {
    if (!body.success) throw new Error(body.error ?? 'Request failed');
    return body.data;
  }
  return body;
}
