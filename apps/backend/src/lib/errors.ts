/**
 * Raised when an audit that injected a saved login session still landed on a
 * login screen — the session has expired, so the numbers would describe the
 * login page rather than the page the user asked about.
 */
export class SessionExpiredError extends Error {
  readonly code = 'SESSION_EXPIRED';

  constructor(readonly loginUrl: string) {
    super('Saved session has expired — the audit was redirected to a login page. Capture the session again.');
    this.name = 'SessionExpiredError';
  }
}
