/**
 * Whether this browser has ever received Gemini commentary from this install.
 *
 * The analyzer draws an "AI Insights" card *while a run is in flight*, so the report does
 * not grow a block above the vitals the moment the result lands. That card is a promise,
 * and on a deployment with no `GEMINI_API_KEY` it would be a false one: the server answers
 * an empty payload, the finished report renders no AI at all, and the skeleton would have
 * been a placeholder for a feature that is switched off — the one thing every AI surface
 * in this app refuses to do.
 *
 * There is no flag on the wire that says "AI is configured" (the server simply says
 * nothing), so this remembers the answer the only way a client can: by having seen one.
 * First run on a fresh browser shows no card; every run after one lands does.
 */
const KEY = 'perfscope-ai-seen';

export function hasSeenAi(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    // Private mode, blocked site data: fall back to not promising anything.
    return false;
  }
}

export function markAiSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch { /* nothing to do — the promise simply is not made next time */ }
}
