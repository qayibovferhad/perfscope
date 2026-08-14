/**
 * Probe: does the timeline-waterfall placeholder occupy the same geometry the real panel
 * takes once the audit lands? That is the placeholder's entire contract, and it is what
 * broke when its measurements were literals copied from the live component.
 *
 * Needs both dev servers running. Run: node e2e/waterfall-skeleton.probe.mjs
 */
import { WEB_URL, waitForServers, registerUser, launchAuthedBrowser, cleanupUser } from './helpers.mjs';

const TARGET = process.env.PROBE_URL ?? 'https://example.com';

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page } = await launchAuthedBrowser({ user, token });

/**
 * The resource column is the only element the panel sizes with an explicit inline width,
 * so `style.width` picks it out exactly rather than by guessing at dimensions. The axis
 * row is the one of those that also carries an explicit height.
 */
const geometry = () =>
  page.evaluate(() => {
    const cols = [...document.querySelectorAll('div[style*="width"]')]
      .filter((d) => d.style.width !== '' && d.style.width !== '100%');
    if (cols.length === 0) return null;
    const axis = cols.find((d) => d.style.height !== '') ?? null;
    // Only the structural numbers are comparable. The rest of the inline widths are bar
    // lengths — the placeholder draws an invented cascade, the live panel draws the real
    // requests, and those are *supposed* to differ.
    const widths = cols.map((d) => d.offsetWidth);
    return {
      resourceColumn: widths.filter((w) => w === 280).length,
      axisRowHeight: axis ? axis.offsetHeight : null,
      barWidths: [...new Set(widths.filter((w) => w !== 280))].sort((a, b) => a - b),
    };
  });

try {
  await page.goto(`${WEB_URL}/app`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /analyze|new audit/i.test(document.body.innerText), { timeout: 20_000 });

  const input = await page.waitForSelector('input[type="text"], input[type="url"]', { timeout: 10_000 });
  await input.type(TARGET);
  await page.keyboard.press('Enter');

  // While streaming: the placeholder is up.
  await page.waitForFunction(
    () => document.querySelector('.wf-sk-shim') !== null,
    { timeout: 30_000 },
  );
  const skeleton = await geometry();
  console.log('placeholder :', JSON.stringify(skeleton));

  // Once the waterfall data lands the placeholder is replaced.
  await page.waitForFunction(
    () => document.querySelector('.wf-sk-shim') === null
      && /resource/i.test(document.body.innerText),
    { timeout: 180_000 },
  );
  await new Promise((r) => setTimeout(r, 800));
  const live = await geometry();
  console.log('live panel  :', JSON.stringify(live));

  const same = skeleton && live
    && skeleton.resourceColumn > 0 && live.resourceColumn > 0
    && skeleton.axisRowHeight === live.axisRowHeight;
  console.log(`\nresource columns at 280px  ${skeleton?.resourceColumn} -> ${live?.resourceColumn}`);
  console.log(`axis row height            ${skeleton?.axisRowHeight} -> ${live?.axisRowHeight}`);
  console.log(`(bar widths differ by design: ${skeleton?.barWidths.length} invented -> ${live?.barWidths.length} real)`);
  console.log(same ? '\nNOTHING SHIFTED — contract holds' : '\nGEOMETRY CHANGED — placeholder is lying');
  process.exitCode = same ? 0 : 1;
} finally {
  await browser.close();
  await cleanupUser(email);
}
