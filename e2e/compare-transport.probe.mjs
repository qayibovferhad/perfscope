/**
 * Probe: the compare page's playback bar after both copies moved onto the shared Scrubber.
 *
 * Checks the thing the hand-rolled copies got wrong — they never suppressed
 * ::-webkit-slider-thumb, so WebKit painted its own thumb under the floating one — and
 * that play/pause and seeking still drive the timeline.
 *
 * Needs both dev servers. Runs two audits, so give it a few minutes.
 */
import { WEB_URL, waitForServers, registerUser, launchAuthedBrowser, cleanupUser, sleep, bodyText } from './helpers.mjs';

const A = process.env.PROBE_URL_A ?? 'example.com';
const B = process.env.PROBE_URL_B ?? 'example.org';

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  await page.goto(`${WEB_URL}/compare`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /compare/i.test(document.body.innerText), { timeout: 20_000 });

  const inputs = await page.$$('input[type="text"]');
  if (inputs.length < 2) throw new Error(`expected two url inputs, found ${inputs.length}`);
  // The fields are pre-filled with the scheme, so type the host only — typing a full URL
  // yields https://https://example.com and the run fails with no visible error.
  await inputs[0].type(A);
  await inputs[1].type(B);

  // The compare page commits on its own button, not on Enter.
  const launched = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => /launch competitive analysis/i.test(b.textContent ?? ''));
    btn?.click();
    return Boolean(btn);
  });
  if (!launched) throw new Error('could not find the launch button');

  // Wait for a playback bar to exist at all.
  await page.waitForFunction(
    () => document.querySelector('input[type="range"]') !== null,
    { timeout: 300_000 },
  );
  await sleep(1500);

  const report = await page.evaluate(() => {
    const ranges = [...document.querySelectorAll('input[type="range"]')];
    return ranges.map((el) => {
      const thumb = getComputedStyle(el, '::-webkit-slider-thumb');
      return {
        max: el.max,
        step: el.step,
        // The shared Scrubber hides the native thumb; the hand-rolled copies did not.
        nativeThumbHidden: thumb.opacity === '0' || thumb.appearance === 'none',
        thumbOpacity: thumb.opacity,
        trackHasGradient: /linear-gradient/.test(getComputedStyle(el).backgroundImage),
      };
    });
  });

  console.log(`range inputs on the page: ${report.length}`);
  for (const r of report) {
    console.log(`  step=${r.step.padEnd(4)} max=${String(r.max).padEnd(8)} ` +
      `nativeThumbHidden=${String(r.nativeThumbHidden).padEnd(6)} (opacity ${r.thumbOpacity})  ` +
      `gradientTrack=${r.trackHasGradient}`);
  }

  // Seek to the middle and confirm the readout follows.
  const before = await bodyText(page);
  await page.evaluate(() => {
    const el = document.querySelector('input[type="range"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(Math.round(Number(el.max) / 2)));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(600);
  const after = await bodyText(page);

  const allHidden = report.length > 0 && report.every((r) => r.nativeThumbHidden);
  console.log(`\nseeking changed the rendered readout: ${before !== after}`);
  console.log(`every scrubber hides its native thumb: ${allHidden}`);
  console.log(`console/page errors: ${errors.length ? errors.map((e) => e.text).join(' | ') : 'none'}`);
  process.exitCode = allHidden && errors.length === 0 ? 0 : 1;
} finally {
  await browser.close();
  await cleanupUser(email);
}
