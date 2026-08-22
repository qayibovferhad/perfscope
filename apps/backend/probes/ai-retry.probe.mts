/**
 * Does `generate()` survive a transient Gemini failure, and does it refuse to retry a
 * permanent one?
 *
 * Gemini answers 503 "experiencing high demand" under load — hit twice in a row while
 * measuring model tiers. Because AI is generated at write time and stored, a lost
 * response is lost for good, so the retry is the difference between an audit with a
 * diagnosis and an audit with a hole.
 *
 * The failure is injected at `fetch`, which is what the SDK uses, so the whole real path
 * (SDK, deadline, cache, tally) is exercised. Scenario 1's second attempt goes to the
 * real API, so this needs `GEMINI_API_KEY` — it proves recovery, not just a counter.
 *
 *     npx tsx probes/ai-retry.probe.mts
 */
import { generate, aiUsageSnapshot } from '../src/services/ai/client.js';

const realFetch = globalThis.fetch;
const canned = (status: number, statusText: string) =>
  new Response(JSON.stringify({ error: { status, message: `injected ${statusText}` } }),
    { status, statusText, headers: { 'content-type': 'application/json' } });

let injected = 0;
/** `fail` decides what the nth call returns; `null` means let it reach Google. */
function inject(fail: (n: number) => Response | null) {
  injected = 0;
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    const canned = fail(++injected);
    return canned ? Promise.resolve(canned) : realFetch(...args);
  }) as typeof fetch;
}

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

// ── 1. A 503 on the first attempt is retried, and the answer survives ─────────
inject(n => (n === 1 ? canned(503, 'Service Unavailable') : null));
const recovered = await generate('Reply with the single word: alive', { label: 'retry-503' })
  .catch((err: unknown) => { console.log(`  (threw: ${String(err).slice(0, 90)})`); return ''; });
const tally503 = aiUsageSnapshot()['retry-503'];

console.log('\n503 on first attempt');
check(injected === 2, `two HTTP attempts made (saw ${injected})`);
check(recovered.trim().length > 0, `answer recovered ("${recovered.trim().slice(0, 20)}")`);
check(tally503?.retries === 1, `tallied 1 retry (saw ${tally503?.retries ?? 0})`);
check((tally503?.failures ?? 0) === 0, `tallied no failure (saw ${tally503?.failures ?? 0})`);

// ── 2. A 400 is permanent — retrying it would just cost a second call ─────────
inject(() => canned(400, 'Bad Request'));
const threw = await generate('Reply with the single word: alive too', { label: 'no-retry-400' })
  .then(() => false).catch(() => true);
const tally400 = aiUsageSnapshot()['no-retry-400'];

console.log('\n400 on every attempt');
check(threw, 'the error reached the caller');
check(injected === 1, `one HTTP attempt only (saw ${injected})`);
check((tally400?.retries ?? 0) === 0, `tallied no retry (saw ${tally400?.retries ?? 0})`);
check(tally400?.failures === 1, `tallied 1 failure (saw ${tally400?.failures ?? 0})`);

// ── 3. A retry that cannot fit the caller's deadline is not started ───────────
inject(() => canned(503, 'Service Unavailable'));
const start = Date.now();
await generate('Reply with the single word: alive again', { label: 'deadline', timeoutMs: 2_000 })
  .catch(() => null);
const elapsed = Date.now() - start;
const tallyDeadline = aiUsageSnapshot()['deadline'];

console.log('\n503 with 2s left on the clock');
check(injected === 1, `one HTTP attempt only (saw ${injected})`);
check((tallyDeadline?.retries ?? 0) === 0, 'no retry attempted inside a deadline too short for one');
check(elapsed < 1_500, `returned without sleeping out the backoff (${elapsed}ms)`);

globalThis.fetch = realFetch;
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
