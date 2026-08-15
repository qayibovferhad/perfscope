/**
 * Runs one real comparison and captures it in both themes.
 *
 * The compare page's filmstrip and comparison engine only exist once two audits have
 * finished, so they are invisible to the page-level screenshot probe. They are also where
 * the hardcoded colours lived — raw hex for the timeline markers and Tailwind red-500 for
 * the regression rows — which is exactly the kind of thing that looks fine in the theme it
 * was written in and wrong in the other one.
 *
 *   node e2e/compare-visual.probe.mjs [outDir]
 */
import { mkdirSync } from 'node:fs';
import { WEB_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep } from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-compare';
mkdirSync(OUT, { recursive: true });

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  await page.goto(`${WEB_URL}/compare`, { waitUntil: 'networkidle0' });
  await sleep(2000);

  const inputs = await page.$$('input[type="text"]');
  for (const [input, url] of [[inputs[0], 'https://example.com'], [inputs[1], 'https://example.org']]) {
    await input.click({ clickCount: 3 });
    await input.type(url);
  }
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /compare|launch|run/i.test(b.textContent ?? ''));
    btn?.click();
  });
  console.log('comparing example.com vs example.org …');

  // Wait for the filmstrip, which is the last thing to appear.
  for (let i = 0; i < 240; i++) {
    if (await page.evaluate(() => /filmstrip/i.test(document.body.innerText))) break;
    await sleep(500);
  }
  await sleep(2500);

  // `fullPage` captures only the viewport here: the dashboard shell scrolls <main>, not the
  // document, so the body never grows. Scroll that element instead and shoot each stop.
  const STOPS = [
    ['scoreboard', 0],
    ['filmstrip',  0.55],
    ['engine',     1],
  ];

  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => {
      localStorage.setItem('perfscope-theme', t);
      if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
    }, theme);
    await sleep(700);

    for (const [name, frac] of STOPS) {
      await page.evaluate((f) => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = (main.scrollHeight - main.clientHeight) * f;
      }, frac);
      await sleep(600);
      await page.screenshot({ path: `${OUT}/${theme}-${name}.png` });
    }
    console.log(`  captured ${theme} (${STOPS.length} stops)`);
  }
  console.log(`\nwritten to ${OUT}`);
  console.log(`console errors: ${errors.length ? errors.map((e) => e.text).slice(0, 3).join(' | ') : 'none'}`);
} finally {
  await browser.close();
  await cleanupUser(email);
}
