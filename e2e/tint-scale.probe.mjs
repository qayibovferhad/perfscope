/**
 * Probe: the amber/rose tint scale.
 *
 * Components used to write raw `rgba(230,162,60,…)` at 22 different alphas, which pinned
 * them to the dark hue — in light theme the tint disagreed with the text on it. They now
 * use five named steps. This checks each step resolves, that they are ordered, and that
 * every one is built from the theme's own hue.
 */
import { WEB_URL, waitForServers, registerUser, launchAuthedBrowser, cleanupUser, sleep } from './helpers.mjs';

const STEPS = ['wash', 'soft', 'fill', 'line', 'strong'];

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page } = await launchAuthedBrowser({ user, token });

const read = () =>
  page.evaluate((steps) => {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    const out = { theme: document.documentElement.getAttribute('data-theme') ?? '(system)' };
    for (const hue of ['amber', 'rose']) {
      out[hue] = { base: g(`--ld-${hue}`), rgb: g(`--ld-${hue}-rgb`) };
      for (const s of steps) out[hue][s] = g(`--ld-${hue}-${s}`);
    }
    return out;
  }, STEPS);

const alphaOf = (v) => Number((v.match(/,\s*([0-9.]+)\s*\)$/) ?? [])[1]);
const channelsOf = (v) => (v.match(/rgba?\(\s*([0-9]+,\s*[0-9]+,\s*[0-9]+)/) ?? [])[1]?.replace(/\s/g, '');

try {
  await page.goto(`${WEB_URL}/dashboard`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /dashboard/i.test(document.body.innerText), { timeout: 20_000 });

  let bad = 0;
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await sleep(250);
    const r = await read();
    console.log(`\n[${r.theme}]`);
    for (const hue of ['amber', 'rose']) {
      const h = r[hue];
      const chans = h.rgb.replace(/\s/g, '');
      const alphas = STEPS.map((s) => alphaOf(h[s]));
      const ordered = alphas.every((a, i) => i === 0 || a > alphas[i - 1]);
      const sameHue = STEPS.every((s) => channelsOf(h[s]) === chans);
      if (!ordered || !sameHue || alphas.some(Number.isNaN)) bad++;
      console.log(`  ${hue.padEnd(5)} ${h.base}  channels ${h.rgb}`);
      console.log(`        ${STEPS.map((s, i) => `${s}=${alphas[i]}`).join('  ')}`);
      console.log(`        ascending: ${ordered}   every step built from this theme's hue: ${sameHue}`);
    }
  }
  console.log(bad === 0
    ? '\nboth themes: five ordered steps, all from the theme\'s own hue'
    : `\n${bad} problem(s)`);
  process.exitCode = bad === 0 ? 0 : 1;
} finally {
  await browser.close();
  await cleanupUser(email);
}
