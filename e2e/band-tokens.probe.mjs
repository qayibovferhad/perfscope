/**
 * Probe: do the warn/poor band tiles follow the theme now?
 *
 * --ld-amber and --ld-rose are different hues per theme (#e6a23c/#b9791a,
 * #f2647a/#d63a57), but BAND_TILE used to hardcode the dark-theme RGB in its rgba()
 * background and border. So in light theme the tint disagreed with the text sitting on
 * it. This reads the resolved tokens in both themes and checks the tint tracks the hue.
 */
import { WEB_URL, waitForServers, registerUser, launchAuthedBrowser, cleanupUser, sleep } from './helpers.mjs';

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page } = await launchAuthedBrowser({ user, token });

const read = () =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    return {
      theme: document.documentElement.getAttribute('data-theme') ?? '(system)',
      amber: g('--ld-amber'), amberSoft: g('--ld-amber-soft'), amberLine: g('--ld-amber-line'),
      rose:  g('--ld-rose'),  roseSoft:  g('--ld-rose-soft'),  roseLine:  g('--ld-rose-line'),
    };
  });

/** "#e6a23c" -> "230, 162, 60" so a hex can be compared with the rgba() it should tint. */
const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');
};

try {
  await page.goto(`${WEB_URL}/dashboard`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /dashboard/i.test(document.body.innerText), { timeout: 20_000 });

  const seen = [];
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await sleep(250);
    seen.push(await read());
  }

  let bad = 0;
  for (const s of seen) {
    const amberOk = s.amberSoft.includes(hexToRgb(s.amber)) && s.amberLine.includes(hexToRgb(s.amber));
    const roseOk  = s.roseSoft.includes(hexToRgb(s.rose))   && s.roseLine.includes(hexToRgb(s.rose));
    if (!amberOk || !roseOk) bad++;
    console.log(`\n[${s.theme}]`);
    console.log(`  amber ${s.amber}  soft ${s.amberSoft}  line ${s.amberLine}   tint matches hue: ${amberOk}`);
    console.log(`  rose  ${s.rose}  soft ${s.roseSoft}  line ${s.roseLine}   tint matches hue: ${roseOk}`);
  }

  console.log(bad === 0
    ? '\nboth themes: the tints are built from that theme\'s own hue'
    : `\n${bad} theme(s) still tinting with the wrong hue`);
  process.exitCode = bad === 0 ? 0 : 1;
} finally {
  await browser.close();
  await cleanupUser(email);
}
