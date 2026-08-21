/**
 * Every artifact parser answers malformed input with `null`, and every caller treats
 * that as "this page has no such data" — the right degradation for a missing artifact,
 * and exactly the wrong one for a Lighthouse upgrade that changed a trace shape: all
 * eight parsers swallowed their exceptions, so a breaking format change would have
 * produced empty panels on every audit with not one log line anywhere.
 */
export function parseFailed(parser: string, err: unknown): null {
  console.warn(`[parse:${parser}] failed — treating as "no data":`, err);
  return null;
}
