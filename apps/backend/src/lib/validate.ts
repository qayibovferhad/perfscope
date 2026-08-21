/**
 * The one email-shape check. Deliberately loose (anything@anything.tld): the strict
 * grammar rejects real addresses, and the only delivery guarantee is sending to it —
 * this exists to catch pasted names and empty strings, not to police RFC 5322.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
